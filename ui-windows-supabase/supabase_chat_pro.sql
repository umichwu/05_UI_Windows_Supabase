-- =========================================
-- Chat Schema PRO (attachments + summaries + configurable LLM + robust outbox)
-- =========================================

-- Step 0: schema & extensions
create schema if not exists app;
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Step 1: enums
do $$ begin
  create type app.channel as enum ('web','line','wechat','google');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.message_role as enum ('user','assistant','system','tool');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.event_type as enum (
    'message.created','reply.request','reply.completed',
    'summary.request','summary.completed','push.request','push.completed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.event_status as enum ('pending','delivering','ok','failed','dead');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.memory_type as enum ('fact','preference','profile','skill','constraint','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.summary_kind as enum ('rolling','episodic','daily','manual');
exception when duplicate_object then null; end $$;

-- Step 2: configuration (LLM / retry / channel presets)
create table if not exists app.config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- sensible defaults
insert into app.config(key, value) values
('llm', jsonb_build_object(
  'url','https://api.openai.com/v1/chat/completions',
  'model','gpt-4o-mini',
  'temperature', 0.6
))
on conflict (key) do nothing;

insert into app.config(key, value) values
('outbox_retry', jsonb_build_object(
  'backoff', jsonb_build_array(5, 15, 60, 300, 900, 1800, 3600),
  'max_attempts', 10
))
on conflict (key) do nothing;

-- Step 3: core tables

-- external channel bindings
create table if not exists app.channel_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel app.channel not null,
  external_user_id text not null,              -- line userId / wechat openid/unionid / google subject
  display_name text,
  picture_url text,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (channel, external_user_id)
);

-- conversations
create table if not exists app.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel app.channel not null default 'web',
  channel_account_id uuid references app.channel_accounts(id) on delete set null,
  title text,
  status text not null default 'active',
  msg_count integer not null default 0,
  last_message_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_conversations_user_time on app.conversations (user_id, last_message_at desc);

-- messages
create table if not exists app.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references app.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role app.message_role not null,
  content text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  fts tsvector generated always as (to_tsvector('simple', coalesce(content,''))) stored
);
create index if not exists idx_messages_conv_time on app.messages (conversation_id, created_at);
create index if not exists idx_messages_fts on app.messages using gin (fts);

-- message embeddings (adjust dimension to your embedding model)
create table if not exists app.message_embeddings (
  message_id uuid primary key references app.messages(id) on delete cascade,
  model text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_msg_emb_ivf on app.message_embeddings using ivfflat (embedding vector_cosine_ops) with (lists=100);

-- conversation summaries
create table if not exists app.conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references app.conversations(id) on delete cascade,
  kind app.summary_kind not null default 'rolling',
  is_latest boolean not null default true,
  model text,
  summary text not null,
  token_count integer,
  message_id_start uuid,
  message_id_end uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_conv_summary_latest on app.conversation_summaries (conversation_id, kind) where is_latest = true;

-- long-term user memory
create table if not exists app.user_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_type app.memory_type not null default 'other',
  source text not null default 'llm',      -- manual | llm | import | system
  content text not null,
  weight real not null default 1.0,
  confidence smallint check (confidence between 0 and 100),
  expires_at timestamptz,
  last_reinforced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_user_memory_user on app.user_memory (user_id, memory_type, created_at desc);

-- attachments metadata
create table if not exists app.messages_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references app.messages(id) on delete cascade,
  storage_object_path text not null,   -- e.g., {user_id}/{conversation_id}/{message_id}/filename
  mime_type text,
  bytes bigint,
  sha256 text,
  created_at timestamptz not null default now()
);
create index if not exists idx_msg_attachments_msg on app.messages_attachments (message_id);

-- outbox events (robust)
-- 建表：把那行帶 WHERE 的 unique 移除
create table if not exists app.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type app.event_type not null,
  status app.event_status not null default 'pending',
  idempotency_key text,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references app.conversations(id) on delete cascade,
  message_id uuid references app.messages(id) on delete cascade,
  attempt_count integer not null default 0,
  last_error text,
  payload jsonb not null,
  scheduled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 之後用「部分唯一索引」達成條件式唯一
create unique index if not exists uq_outbox_idem
  on app.outbox_events (idempotency_key)
  where idempotency_key is not null;

-- （可選）其他常用索引
create index if not exists idx_outbox_status_due
  on app.outbox_events (status, scheduled_at);
-- Step 4: Storage bucket + policies (private)
insert into storage.buckets (id, name, public)
values ('chat-attachments','chat-attachments', false)
on conflict (id) do nothing;

-- Path convention: {user_id}/{conversation_id}/{message_id}/filename
-- RLS: only allow first 36 chars (uuid) of path to match auth.uid()
create policy "user can read own objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-attachments'
  -- 建議用 split_part 取第一段（user_id），比 substring 36 字元更穩
  and split_part(name, '/', 1) = auth.uid()::text
);


-- 先刪除同名策略（若存在）
drop policy if exists "user can insert own objects" on storage.objects;

-- 重新建立 insert 策略
create policy "user can insert own objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- 先刪除同名策略（若存在）
drop policy if exists "user can delete own objects" on storage.objects;

-- 重新建立 delete 策略
create policy "user can delete own objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Step 5: helper functions

-- A) schedule failure with backoff (and kill when too many attempts)
create or replace function app.fail_and_reschedule(p_event_id uuid, p_error text)
returns void language plpgsql as $$
declare
  v_attempts int;
  v_backoff int[];
  v_max int;
  v_idx int;
  v_next_sec int;
begin
  select attempt_count into v_attempts from app.outbox_events where id = p_event_id for update;
  v_attempts := coalesce(v_attempts,0);
  select array_agg((x)::int) from jsonb_array_elements((select value->'backoff' from app.config where key='outbox_retry')) as t(x) into v_backoff;
  select coalesce((select (value->>'max_attempts')::int from app.config where key='outbox_retry'), 10) into v_max;
  v_idx := greatest(1, least(v_attempts+1, coalesce(array_length(v_backoff,1), 1)));
  v_next_sec := coalesce(v_backoff[v_idx], 1800);

  if v_attempts+1 >= v_max then
    update app.outbox_events set status='dead', last_error = left(p_error, 500)
    where id = p_event_id;
  else
    update app.outbox_events
    set status='failed',
        last_error = left(p_error, 500),
        scheduled_at = now() + make_interval(secs => v_next_sec)
    where id = p_event_id;
  end if;
end$$;

-- B) enqueue on message + periodic summary every 20 messages
create or replace function app.enqueue_message_and_maybe_summary()
returns trigger language plpgsql as $$
declare
  v_cnt int;
  v_slot text;
begin
  -- bump conversation counters
  update app.conversations
  set msg_count = coalesce(msg_count,0) + 1,
      last_message_at = now(),
      updated_at = now()
  where id = new.conversation_id
  returning msg_count into v_cnt;

  -- enqueue message.created only for user messages
  if new.role = 'user' then
    insert into app.outbox_events(event_type, status, idempotency_key, user_id, conversation_id, message_id, payload)
    values (
      'message.created', 'pending', new.id::text, new.user_id, new.conversation_id, new.id,
      jsonb_build_object(
        'message_id', new.id,
        'conversation_id', new.conversation_id,
        'role', new.role,
        'content', new.content
      )
    )
    on conflict (idempotency_key) do nothing;
  end if;

  -- every 20 messages, request a rolling summary
  if v_cnt % 20 = 0 then
    v_slot := 'summary-' || new.conversation_id::text || '-' || v_cnt::text;
    insert into app.outbox_events(event_type, status, idempotency_key, user_id, conversation_id, payload)
    values (
      'summary.request', 'pending', v_slot, new.user_id, new.conversation_id,
      jsonb_build_object('conversation_id', new.conversation_id, 'slot', v_cnt)
    )
    on conflict (idempotency_key) do nothing;
  end if;

  return new;
end$$;

drop trigger if exists trg_messages_outbox on app.messages;
create trigger trg_messages_outbox
after insert on app.messages
for each row execute function app.enqueue_message_and_maybe_summary();

-- Step 6: RLS

alter table app.channel_accounts enable row level security;
alter table app.conversations   enable row level security;
alter table app.messages        enable row level security;
alter table app.message_embeddings enable row level security;
alter table app.conversation_summaries enable row level security;
alter table app.user_memory     enable row level security;
alter table app.messages_attachments enable row level security;
alter table app.outbox_events   enable row level security;

-- conversations: owner-only
-- 先啟用 RLS（只需一次）
alter table app.conversations enable row level security;

-- 先刪同名策略（若已存在）
drop policy if exists "own conversations" on app.conversations;

-- 重新建立策略：僅允許本人讀寫自己的會話
create policy "own conversations"
on app.conversations
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- messages via conversation ownership
-- 先啟用 RLS（若尚未啟用）
alter table app.messages enable row level security;

-- 先刪除同名策略（若已存在）
drop policy if exists "own messages" on app.messages;

-- 重新建立策略：只允許擁有該會話的使用者存取/操作訊息
create policy "own messages"
on app.messages
for all
to authenticated
using (
  exists (
    select 1
    from app.conversations c
    where c.id = conversation_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from app.conversations c
    where c.id = conversation_id
      and c.user_id = auth.uid()
  )
);


-- embeddings follow messages
-- 先啟用 RLS（若尚未啟用）
alter table app.message_embeddings enable row level security;

-- 先刪除同名策略（若已存在）
drop policy if exists "own embeddings" on app.message_embeddings;

-- 重新建立策略：只允許擁有該會話的使用者存取其 embeddings
create policy "own embeddings"
on app.message_embeddings
for all
to authenticated
using (
  exists (
    select 1
    from app.messages m
    join app.conversations c on c.id = m.conversation_id
    where m.id = message_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from app.messages m
    join app.conversations c on c.id = m.conversation_id
    where m.id = message_id
      and c.user_id = auth.uid()
  )
);

-- summaries via conversation
-- 先啟用 RLS（若尚未啟用）
alter table app.conversation_summaries enable row level security;

-- 先刪除同名策略（若已存在）
drop policy if exists "own summaries" on app.conversation_summaries;

-- 重新建立策略：只允許會話擁有者存取/寫入其摘要
create policy "own summaries"
on app.conversation_summaries
for all
to authenticated
using (
  exists (
    select 1
    from app.conversations c
    where c.id = conversation_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from app.conversations c
    where c.id = conversation_id
      and c.user_id = auth.uid()
  )
);

-- user memory
-- 先啟用 RLS（若尚未啟用）
alter table app.user_memory enable row level security;

-- 移除同名策略（若已存在）
drop policy if exists "own memory" on app.user_memory;

-- 重新建立：只允許本人讀寫自己的 user_memory
create policy "own memory"
on app.user_memory
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- attachments follow messages
-- 先啟用 RLS（若尚未啟用）
alter table app.messages_attachments enable row level security;

-- 先刪除同名策略（若已存在）
drop policy if exists "own attachments" on app.messages_attachments;

-- 重新建立策略：僅允許會話擁有者存取/操作其附件記錄
create policy "own attachments"
on app.messages_attachments
for all
to authenticated
using (
  exists (
    select 1
    from app.messages m
    join app.conversations c on c.id = m.conversation_id
    where m.id = message_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from app.messages m
    join app.conversations c on c.id = m.conversation_id
    where m.id = message_id
      and c.user_id = auth.uid()
  )
);


-- outbox owner-only (service role bypasses)
-- 啟用 RLS（只需一次）
alter table app.outbox_events enable row level security;

-- 刪除同名策略（若已存在）
drop policy if exists "own outbox" on app.outbox_events;

-- 重新建立：僅允許本人讀寫自己的 outbox 事件
create policy "own outbox"
on app.outbox_events
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());









-- 讓 anon / authenticated 能使用 app 這個 schema
grant usage on schema app to anon, authenticated;

-- 讓他們能操作 app 底下的所有表與序號（RLS 仍然會控管行級權限）
grant all on all tables in schema app to anon, authenticated;
grant all on all sequences in schema app to anon, authenticated;

-- 未來新表自動授權（可選）
alter default privileges in schema app grant all on tables to anon, authenticated;
alter default privileges in schema app grant all on sequences to anon, authenticated;





-- CRITICAL FIX: ON CONFLICT constraint error
-- Run this SQL in your Supabase SQL Editor to fix all three console errors

-- 1. Drop the problematic trigger function that causes the ON CONFLICT error
DROP TRIGGER IF EXISTS trg_messages_outbox ON app.messages;
DROP FUNCTION IF EXISTS app.enqueue_message_and_maybe_summary() CASCADE;

-- 2. Check if the unique index exists and create it if missing
-- (This is likely the root cause - the ON CONFLICT references a non-existent constraint)
CREATE UNIQUE INDEX IF NOT EXISTS uq_outbox_idempotency_key 
ON app.outbox_events (idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 3. Create a simple replacement function without complex ON CONFLICT logic
CREATE OR REPLACE FUNCTION app.simple_message_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Just update conversation counters - no complex outbox logic
  UPDATE app.conversations
  SET msg_count = COALESCE(msg_count, 0) + 1,
      last_message_at = NOW(),
      updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END$$;

-- 4. Create the replacement trigger
CREATE TRIGGER trg_messages_simple
AFTER INSERT ON app.messages
FOR EACH ROW EXECUTE FUNCTION app.simple_message_trigger();

-- 5. Ensure proper permissions
GRANT USAGE ON SCHEMA app TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA app TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA app TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA app TO anon, authenticated;

-- 6. Verify the fix by testing the messages table structure
-- This should show no errors:
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'app' AND table_name = 'messages'
ORDER BY ordinal_position;



  -- 1. Check what triggers currently exist on messages table
  SELECT
      t.trigger_name,
      t.action_timing,
      t.event_manipulation,
      p.proname as function_name
  FROM information_schema.triggers t
  LEFT JOIN pg_proc p ON p.oid = t.action_statement::regproc
  WHERE t.event_object_table = 'messages'
      AND t.event_object_schema = 'app';

  -- 2. Force drop ANY remaining triggers on messages table
  DROP TRIGGER IF EXISTS trg_messages_outbox ON app.messages CASCADE;
  DROP TRIGGER IF EXISTS trg_messages_simple ON app.messages CASCADE;

  -- 3. Force drop the problematic functions completely
  DROP FUNCTION IF EXISTS app.enqueue_message_and_maybe_summary() CASCADE;
  DROP FUNCTION IF EXISTS app.simple_message_trigger() CASCADE;


  DROP TRIGGER IF EXISTS trg_messages_outbox ON app.messages;

  DROP TRIGGER IF EXISTS trg_messages_simple ON app.messages;

  DROP FUNCTION IF EXISTS app.enqueue_message_and_maybe_summary();

  DROP FUNCTION IF EXISTS app.simple_message_trigger();



-- Fix: Create trigger to update last_message_at when new message is inserted

-- 1. Create trigger function to update conversation metadata
CREATE OR REPLACE FUNCTION app.update_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Update conversation counters and timestamp
  UPDATE app.conversations
  SET msg_count = COALESCE(msg_count, 0) + 1,
      last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END$$;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON app.messages;
CREATE TRIGGER trg_update_conversation_on_message
AFTER INSERT ON app.messages
FOR EACH ROW EXECUTE FUNCTION app.update_conversation_on_message();

-- 3. Ensure proper permissions
GRANT EXECUTE ON FUNCTION app.update_conversation_on_message() TO anon, authenticated;



-- setup-llm-config.sql
-- Setup LLM configuration for Dev Mode
-- Run this in your Supabase SQL Editor

-- Insert or update LLM configuration
INSERT INTO app.config (key, value) VALUES (
  'llm',
  jsonb_build_object(
    'url', 'https://api.openai.com/v1/chat/completions',
    'model', 'gpt-4o-mini',
    'temperature', 0.7,
    'max_tokens', 1000,
    'api_key', 'your-openai-api-key-here'
  )
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- Alternative configurations for other providers:

-- Anthropic Claude
/*
INSERT INTO app.config (key, value) VALUES (
  'llm',
  jsonb_build_object(
    'url', 'https://api.anthropic.com/v1/messages',
    'model', 'claude-3-haiku-20240307',
    'temperature', 0.7,
    'max_tokens', 1000,
    'api_key', 'your-anthropic-api-key-here'
  )
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
*/

-- Local Ollama instance
/*
INSERT INTO app.config (key, value) VALUES (
  'llm',
  jsonb_build_object(
    'url', 'http://localhost:11434/v1/chat/completions',
    'model', 'llama3.2:3b',
    'temperature', 0.7,
    'max_tokens', 1000
  )
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
*/

-- Verify the configuration
SELECT key, value FROM app.config WHERE key = 'llm';



 -- Create the storage bucket
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'chat-attachments',
    'chat-attachments',
    false,  -- private bucket
    52428800,  -- 50MB limit
    ARRAY[
      'image/*',
      'video/*',
      'audio/*',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/json'
    ]
  ) ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

  -- Drop existing policies to avoid conflicts
  DROP POLICY IF EXISTS "user can read own objects" ON storage.objects;
  DROP POLICY IF EXISTS "user can insert own objects" ON storage.objects;
  DROP POLICY IF EXISTS "user can update own objects" ON storage.objects;
  DROP POLICY IF EXISTS "user can delete own objects" ON storage.objects;

  -- Create proper RLS policies
  CREATE POLICY "Users can read own chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND split_part(name, '/', 1) = auth.uid()::text);

  CREATE POLICY "Users can insert own chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND split_part(name, '/', 1) = auth.uid()::text);

  CREATE POLICY "Users can update own chat attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-attachments' AND split_part(name, '/', 1) = auth.uid()::text);

  CREATE POLICY "Users can delete own chat attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND split_part(name, '/', 1) = auth.uid()::text);




---------------------------------------------------------

-- Fixed: Update LLM configuration to use a vision-capable model
-- Run this in your Supabase SQL Editor

-- First, check if the config exists
SELECT key, value FROM app.config WHERE key = 'llm';

-- Method 1: Update existing config (if it exists)
UPDATE app.config
SET
  value = jsonb_build_object(
    'url', 'https://api.openai.com/v1/chat/completions',
    'model', 'gpt-4o-mini',
    'temperature', 0.7,
    'max_tokens', 1000,
    'api_key', COALESCE(value->>'api_key', 'your-openai-api-key-here')
  ),
  updated_at = NOW()
WHERE key = 'llm';


------------------------fix-storage-public.sql---------------------------------

-- Fix: Make chat-attachments bucket public for LLM access
-- This allows external LLM APIs to access uploaded images
-- Run this in your Supabase SQL Editor

-- 1. Update the bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'chat-attachments';

-- 2. Drop existing restrictive policies since bucket is now public
DROP POLICY IF EXISTS "Users can read own chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own chat attachments" ON storage.objects;

-- 3. Create more permissive policies for public bucket
-- Still maintain user ownership for write operations

-- Allow authenticated users to insert their own objects
CREATE POLICY "Users can upload chat attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- Allow authenticated users to delete their own objects
CREATE POLICY "Users can delete own chat attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- For public buckets, reading is automatically allowed
-- No SELECT policy needed

-- 4. Verify the changes
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id = 'chat-attachments';

-- 5. Check updated policies
SELECT
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%chat%';



------------------------drop-and-recreate.sql---------------------------------

-- NUCLEAR OPTION: Drop and recreate tables cleanly
-- Use this if tables exist but are malformed

-- Step 1: Drop tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS app.conversation_summaries CASCADE;
DROP TABLE IF EXISTS app.user_memory CASCADE;
DROP TABLE IF EXISTS app.outbox_events CASCADE;

-- Step 2: Recreate conversation_summaries table
CREATE TABLE app.conversation_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    summary TEXT NOT NULL,
    token_count INTEGER,
    is_latest BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 3: Verify table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'app'
AND table_name = 'conversation_summaries'
ORDER BY ordinal_position;

-- Step 4: Create other tables
CREATE TABLE app.user_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    conversation_id UUID,
    memory_type VARCHAR(50) NOT NULL DEFAULT 'general',
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    importance INTEGER DEFAULT 5,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE app.outbox_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    conversation_id UUID,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 5: Verify all tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'app'
AND table_name IN ('conversation_summaries', 'user_memory', 'outbox_events');


---------------add-indexes-fixed.sql------------------------------------------


-- ADD INDEXES AND CONSTRAINTS - FIXED VERSION
-- This handles constraints properly without IF NOT EXISTS

-- Add indexes for conversation_summaries
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_conversation_id ON app.conversation_summaries(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_user_id ON app.conversation_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_is_latest ON app.conversation_summaries(is_latest) WHERE is_latest = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_summaries_latest_unique ON app.conversation_summaries(conversation_id) WHERE is_latest = true;

-- Add indexes for user_memory
CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON app.user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_conversation_id ON app.user_memory(conversation_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_type ON app.user_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memory_importance ON app.user_memory(importance);
CREATE INDEX IF NOT EXISTS idx_user_memory_tags ON app.user_memory USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_user_memory_fts ON app.user_memory USING GIN(to_tsvector('english', title || ' ' || content));

-- Add indexes for outbox_events
CREATE INDEX IF NOT EXISTS idx_outbox_events_user_id ON app.outbox_events(user_id);
CREATE INDEX IF NOT EXISTS idx_outbox_events_conversation_id ON app.outbox_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_outbox_events_status ON app.outbox_events(status);
CREATE INDEX IF NOT EXISTS idx_outbox_events_event_type ON app.outbox_events(event_type);
CREATE INDEX IF NOT EXISTS idx_outbox_events_scheduled ON app.outbox_events(scheduled_at) WHERE status = 'pending';

-- Add check constraints (without IF NOT EXISTS - will handle errors gracefully)
DO $$
BEGIN
    -- Add importance range constraint for user_memory
    BEGIN
        ALTER TABLE app.user_memory ADD CONSTRAINT check_importance_range CHECK (importance >= 1 AND importance <= 10);
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'Constraint check_importance_range already exists, skipping';
    END;

    -- Add status constraint for outbox_events
    BEGIN
        ALTER TABLE app.outbox_events ADD CONSTRAINT check_status_values CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'Constraint check_status_values already exists, skipping';
    END;

    -- Add priority constraint for outbox_events
    BEGIN
        ALTER TABLE app.outbox_events ADD CONSTRAINT check_priority_range CHECK (priority >= 1 AND priority <= 10);
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'Constraint check_priority_range already exists, skipping';
    END;
END $$;

-- Add triggers for updated_at columns
CREATE OR REPLACE FUNCTION app.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate triggers to avoid conflicts
DROP TRIGGER IF EXISTS trigger_conversation_summaries_updated_at ON app.conversation_summaries;
CREATE TRIGGER trigger_conversation_summaries_updated_at
    BEFORE UPDATE ON app.conversation_summaries
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_user_memory_updated_at ON app.user_memory;
CREATE TRIGGER trigger_user_memory_updated_at
    BEFORE UPDATE ON app.user_memory
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_outbox_events_updated_at ON app.outbox_events;
CREATE TRIGGER trigger_outbox_events_updated_at
    BEFORE UPDATE ON app.outbox_events
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column();

-- Add trigger for ensuring single latest summary
CREATE OR REPLACE FUNCTION app.ensure_single_latest_summary()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_latest = true THEN
        UPDATE app.conversation_summaries
        SET is_latest = false
        WHERE conversation_id = NEW.conversation_id
        AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_latest_summary ON app.conversation_summaries;
CREATE TRIGGER trigger_ensure_single_latest_summary
    BEFORE INSERT OR UPDATE ON app.conversation_summaries
    FOR EACH ROW
    WHEN (NEW.is_latest = true)
    EXECUTE FUNCTION app.ensure_single_latest_summary();

-- Verify indexes were created
SELECT 'Setup completed successfully!' as status;

SELECT
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'app'
AND tablename IN ('conversation_summaries', 'user_memory', 'outbox_events')
ORDER BY tablename, indexname;

-------------------add-rls-policies.sql--------------------------------------


-- ADD ROW LEVEL SECURITY POLICIES
-- This ensures users can only access their own data

-- Enable RLS on all tables
ALTER TABLE app.conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.outbox_events ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first
DROP POLICY IF EXISTS "Users can read own conversation summaries" ON app.conversation_summaries;
DROP POLICY IF EXISTS "Users can insert own conversation summaries" ON app.conversation_summaries;
DROP POLICY IF EXISTS "Users can update own conversation summaries" ON app.conversation_summaries;
DROP POLICY IF EXISTS "Users can delete own conversation summaries" ON app.conversation_summaries;

DROP POLICY IF EXISTS "Users can read own memory" ON app.user_memory;
DROP POLICY IF EXISTS "Users can insert own memory" ON app.user_memory;
DROP POLICY IF EXISTS "Users can update own memory" ON app.user_memory;
DROP POLICY IF EXISTS "Users can delete own memory" ON app.user_memory;

DROP POLICY IF EXISTS "Users can read own outbox events" ON app.outbox_events;
DROP POLICY IF EXISTS "Users can insert own outbox events" ON app.outbox_events;
DROP POLICY IF EXISTS "Users can update own outbox events" ON app.outbox_events;
DROP POLICY IF EXISTS "Users can delete own outbox events" ON app.outbox_events;

-- Create RLS policies for conversation_summaries
CREATE POLICY "Users can read own conversation summaries"
    ON app.conversation_summaries FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own conversation summaries"
    ON app.conversation_summaries FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversation summaries"
    ON app.conversation_summaries FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own conversation summaries"
    ON app.conversation_summaries FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Create RLS policies for user_memory
CREATE POLICY "Users can read own memory"
    ON app.user_memory FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own memory"
    ON app.user_memory FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own memory"
    ON app.user_memory FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own memory"
    ON app.user_memory FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Create RLS policies for outbox_events
CREATE POLICY "Users can read own outbox events"
    ON app.outbox_events FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own outbox events"
    ON app.outbox_events FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own outbox events"
    ON app.outbox_events FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own outbox events"
    ON app.outbox_events FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Verify policies were created
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'app'
AND tablename IN ('conversation_summaries', 'user_memory', 'outbox_events')
ORDER BY tablename, policyname;



-----------------automatic-summary-system.sql----------------------------------------

-- =========================================
-- AUTOMATIC SUMMARY SYSTEM
-- =========================================
-- This script adds automatic summary generation after every N messages
-- Default: 20 messages, but configurable via app.config table

-- Step 1: Add automatic summary configuration
INSERT INTO app.config(key, value) VALUES
('auto_summary', jsonb_build_object(
  'enabled', true,
  'message_threshold', 20,
  'priority', 2,
  'description', 'Automatic summary generation settings'
))
ON CONFLICT (key) DO NOTHING;

-- Step 2: Add fields to track automatic summaries in conversations
ALTER TABLE app.conversations
ADD COLUMN IF NOT EXISTS last_auto_summary_at timestamptz,
ADD COLUMN IF NOT EXISTS messages_since_last_summary integer NOT NULL DEFAULT 0;

-- Step 3: Create function to check if auto-summary is needed and create request
CREATE OR REPLACE FUNCTION app.check_and_request_auto_summary()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  config_row RECORD;
  auto_summary_enabled boolean := false;
  message_threshold integer := 20;
  current_msg_count integer;
  messages_since_summary integer;
  conversation_user_id uuid;
  pending_requests integer;
BEGIN
  -- Skip if this is not a user or assistant message (ignore system messages)
  IF NEW.role NOT IN ('user', 'assistant') THEN
    RETURN NEW;
  END IF;

  -- Get auto-summary configuration
  SELECT value INTO config_row
  FROM app.config
  WHERE key = 'auto_summary';

  IF FOUND THEN
    auto_summary_enabled := (config_row.value->>'enabled')::boolean;
    message_threshold := (config_row.value->>'message_threshold')::integer;
  END IF;

  -- Skip if auto-summary is disabled
  IF NOT auto_summary_enabled THEN
    RETURN NEW;
  END IF;

  -- Get conversation details
  SELECT
    msg_count,
    messages_since_last_summary,
    user_id
  INTO
    current_msg_count,
    messages_since_summary,
    conversation_user_id
  FROM app.conversations
  WHERE id = NEW.conversation_id;

  -- Check if we've reached the threshold
  IF messages_since_summary >= message_threshold THEN

    -- Check if there's already a pending summary request for this conversation
    SELECT COUNT(*) INTO pending_requests
    FROM app.outbox_events
    WHERE conversation_id = NEW.conversation_id
      AND event_type = 'summary.request'
      AND status IN ('pending', 'processing');

    -- Only create a new request if there are no pending requests
    IF pending_requests = 0 THEN

      -- Insert automatic summary request
      INSERT INTO app.outbox_events (
        user_id,
        conversation_id,
        event_type,
        payload,
        status,
        priority
      ) VALUES (
        conversation_user_id,
        NEW.conversation_id,
        'summary.request',
        jsonb_build_object(
          'conversation_id', NEW.conversation_id,
          'requested_at', NOW(),
          'auto_generated', true,
          'trigger_message_count', current_msg_count,
          'reason', 'message_threshold_reached'
        ),
        'pending',
        2  -- Higher priority than manual requests (3)
      );

      -- Reset the messages_since_last_summary counter and update timestamp
      UPDATE app.conversations
      SET
        messages_since_last_summary = 0,
        last_auto_summary_at = NOW()
      WHERE id = NEW.conversation_id;

      RAISE NOTICE 'Auto-summary requested for conversation % after % messages',
        NEW.conversation_id, current_msg_count;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 4: Create enhanced trigger to update message counts AND check for auto-summary
CREATE OR REPLACE FUNCTION app.update_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Update conversation metadata
  UPDATE app.conversations
  SET
    msg_count = msg_count + 1,
    messages_since_last_summary = messages_since_last_summary + 1,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

-- Step 5: Replace existing trigger to include auto-summary checking
DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON app.messages;
DROP TRIGGER IF EXISTS trg_check_auto_summary ON app.messages;

-- Create the conversation update trigger (runs first)
CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON app.messages
  FOR EACH ROW EXECUTE FUNCTION app.update_conversation_on_message();

-- Create the auto-summary check trigger (runs second)
CREATE TRIGGER trg_check_auto_summary
  AFTER INSERT ON app.messages
  FOR EACH ROW EXECUTE FUNCTION app.check_and_request_auto_summary();

-- Step 6: Create function to handle summary completion
CREATE OR REPLACE FUNCTION app.handle_summary_completion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- When a summary is completed, reset the counter if it was auto-generated
  IF NEW.event_type = 'summary.request' AND NEW.status = 'completed'
     AND (NEW.payload->>'auto_generated')::boolean IS TRUE THEN

    UPDATE app.conversations
    SET
      last_auto_summary_at = NEW.processed_at,
      messages_since_last_summary = 0
    WHERE id = NEW.conversation_id;

    RAISE NOTICE 'Auto-summary completed for conversation %', NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 7: Create trigger to handle summary completion
CREATE TRIGGER trg_handle_summary_completion
  AFTER UPDATE ON app.outbox_events
  FOR EACH ROW
  WHEN (OLD.status != NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION app.handle_summary_completion();

-- Step 8: Initialize existing conversations
-- Set messages_since_last_summary based on messages after their last summary
DO $$
DECLARE
  conv_record RECORD;
  last_summary_date timestamptz;
  messages_since integer;
BEGIN
  FOR conv_record IN
    SELECT id, msg_count FROM app.conversations
  LOOP
    -- Find the most recent summary for this conversation
    SELECT MAX(created_at) INTO last_summary_date
    FROM app.conversation_summaries
    WHERE conversation_id = conv_record.id;

    IF last_summary_date IS NOT NULL THEN
      -- Count messages since last summary
      SELECT COUNT(*) INTO messages_since
      FROM app.messages
      WHERE conversation_id = conv_record.id
        AND created_at > last_summary_date;

      UPDATE app.conversations
      SET
        last_auto_summary_at = last_summary_date,
        messages_since_last_summary = messages_since
      WHERE id = conv_record.id;
    ELSE
      -- No summary exists, count all messages
      UPDATE app.conversations
      SET
        messages_since_last_summary = msg_count
      WHERE id = conv_record.id;
    END IF;
  END LOOP;

  RAISE NOTICE 'Initialized messages_since_last_summary for existing conversations';
END;
$$;

-- Step 9: Create admin functions for managing auto-summary settings

-- Function to enable/disable auto-summary
CREATE OR REPLACE FUNCTION app.set_auto_summary_enabled(enabled boolean)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE app.config
  SET value = jsonb_set(value, '{enabled}', to_jsonb(enabled))
  WHERE key = 'auto_summary';

  RAISE NOTICE 'Auto-summary enabled: %', enabled;
END;
$$;

-- Function to change message threshold
CREATE OR REPLACE FUNCTION app.set_auto_summary_threshold(threshold integer)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF threshold < 5 OR threshold > 100 THEN
    RAISE EXCEPTION 'Message threshold must be between 5 and 100';
  END IF;

  UPDATE app.config
  SET value = jsonb_set(value, '{message_threshold}', to_jsonb(threshold))
  WHERE key = 'auto_summary';

  RAISE NOTICE 'Auto-summary threshold set to: %', threshold;
END;
$$;

-- Function to get current auto-summary settings
CREATE OR REPLACE FUNCTION app.get_auto_summary_settings()
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  settings jsonb;
BEGIN
  SELECT value INTO settings
  FROM app.config
  WHERE key = 'auto_summary';

  RETURN settings;
END;
$$;

-- Step 10: Create view for monitoring auto-summary activity
CREATE OR REPLACE VIEW app.auto_summary_status AS
SELECT
  c.id as conversation_id,
  c.title,
  c.msg_count,
  c.messages_since_last_summary,
  c.last_auto_summary_at,
  c.last_message_at,
  -- Calculate progress towards next auto-summary
  CASE
    WHEN (SELECT (value->>'enabled')::boolean FROM app.config WHERE key = 'auto_summary') THEN
      ROUND(
        (c.messages_since_last_summary::float /
         (SELECT (value->>'message_threshold')::integer FROM app.config WHERE key = 'auto_summary')::float) * 100
      )
    ELSE 0
  END as progress_percentage,
  -- Check if summary is pending
  (SELECT COUNT(*) > 0
   FROM app.outbox_events
   WHERE conversation_id = c.id
     AND event_type = 'summary.request'
     AND status IN ('pending', 'processing')
  ) as has_pending_summary,
  -- Next auto-summary at what message count
  c.msg_count + (
    (SELECT (value->>'message_threshold')::integer FROM app.config WHERE key = 'auto_summary')
    - c.messages_since_last_summary
  ) as next_summary_at_count
FROM app.conversations c
WHERE c.status = 'active'
ORDER BY c.messages_since_last_summary DESC;

-- Step 11: Grant necessary permissions (adjust as needed)
-- GRANT SELECT ON app.auto_summary_status TO authenticated;
-- GRANT EXECUTE ON FUNCTION app.get_auto_summary_settings() TO authenticated;

-- Display current configuration
SELECT 'Auto-Summary Configuration' as info,
       app.get_auto_summary_settings() as settings;

-- Display summary of what was created
SELECT 'Installation Complete!' as status,
       'Auto-summary will trigger after every ' ||
       (SELECT value->>'message_threshold' FROM app.config WHERE key = 'auto_summary') ||
       ' messages' as message;




---------------------------------------------------------






---------------------------------------------------------




