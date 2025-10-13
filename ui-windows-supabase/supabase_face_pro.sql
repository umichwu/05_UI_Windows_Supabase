-- ========== 0) 先擴充 enum：新增事件型別 ==========
alter type app.event_type add value if not exists 'sensor.face';
alter type app.event_type add value if not exists 'care.trigger';
alter type app.event_type add value if not exists 'care.notify';
alter type app.event_type add value if not exists 'care.resolved';

-- （可選）標準化情緒標籤
do $$ begin
  if not exists (select 1 from pg_type where typname = 'emotion_label') then
    create type app.emotion_label as enum ('angry','disgust','fear','happy','sad','surprise','neutral','unknown');
  end if;
end $$;

-- ========== 1) 臉部樣本（個人臉庫） ==========
create table if not exists app.face_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'default',
  model text not null default 'Facenet512',
  embedding vector(512) not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_face_profiles_user on app.face_profiles(user_id);

alter table app.face_profiles enable row level security;
drop policy if exists "own face profiles" on app.face_profiles;
create policy "own face profiles" on app.face_profiles
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ========== 2) 臉部偵測事件（原始串流） ==========
create table if not exists app.face_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,             -- 送出影像的當前登入者（可選）
  recognized_user_id uuid references auth.users(id) on delete set null,  -- 經辨識後的身份（建議用這個做授權）
  dominant_emotion app.emotion_label,
  emotion_scores jsonb,
  confidence real,                 -- 情緒模型信心（0~1）
  distance real,                   -- 臉部 embedding 最近距離（越小越像）
  is_spoof boolean,               -- 防偽結果（可選）
  source text default 'camera',   -- 來源（camera/mobile/...）
  frame_ts timestamptz not null default now(),
  metadata jsonb
);
create index if not exists idx_face_events_user_time
  on app.face_events(recognized_user_id, frame_ts desc);
create index if not exists idx_face_events_emotion
  on app.face_events(dominant_emotion);

alter table app.face_events enable row level security;
drop policy if exists "own face events" on app.face_events;
create policy "own face events" on app.face_events
for all to authenticated
using (
  -- 允許本人或被辨識為本人者讀寫（前端一般只會 insert；服務端可用 service role 繞過 RLS）
  recognized_user_id = auth.uid() or user_id = auth.uid()
)
with check (
  recognized_user_id = auth.uid() or user_id = auth.uid()
);

-- ========== 3) 滑動視窗彙整（近況快照） ==========
create table if not exists app.mood_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  window_sec integer not null,       -- 例如 60/300/900
  window_start timestamptz not null, -- 左閉右開
  window_end timestamptz not null,
  samples integer not null,
  counts jsonb not null,             -- {sad: 8, neutral: 3, ...}
  dominant_emotion app.emotion_label,
  ratio numeric,                     -- dominant_emotion 比例（0~1）
  avg_confidence numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_mood_windows_user_time
  on app.mood_windows(user_id, window_end desc);

alter table app.mood_windows enable row level security;
drop policy if exists "own mood windows" on app.mood_windows;
create policy "own mood windows" on app.mood_windows
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ========== 4) 關懷規則（使用者可自訂；也支援全域預設） ==========
create table if not exists app.care_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- NULL 表示全域規則（只有 service role 可管理）
  name text not null,
  description text,
  target_emotions app.emotion_label[] not null default array['sad']::app.emotion_label[],
  window_sec integer not null default 180,        -- 在 N 秒內
  min_ratio numeric not null default 0.6,        -- 其中至少 X 比例屬於 target_emotions
  min_confidence numeric not null default 0.6,   -- 情緒信心門檻
  cooldown_sec integer not null default 1800,    -- 觸發後冷卻時間
  active boolean not null default true,
  action jsonb not null default '{}'::jsonb,     -- {template:"", notify_channel:"line", severity:"info"}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_care_rules_user on app.care_rules(user_id);

alter table app.care_rules enable row level security;
drop policy if exists "own care rules" on app.care_rules;
create policy "own care rules" on app.care_rules
for all to authenticated
using (user_id = auth.uid())           -- 只可操作個人規則
with check (user_id = auth.uid());
-- 全域規則（user_id IS NULL）請用 service role 維護

-- ========== 5) 關懷事件（觸發紀錄與生命週期） ==========
create table if not exists app.care_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade, -- 被關懷的人
  rule_id uuid references app.care_rules(id) on delete set null,
  status text not null default 'open',      -- open/ack/closed
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  outbox_event_id uuid references app.outbox_events(id) on delete set null,
  message_id uuid references app.messages(id) on delete set null,     -- 若有建立對話訊息
  context jsonb,                         -- 觸發當下的統計（比例/樣本數等）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_care_incidents_user_status
  on app.care_incidents(user_id, status);

alter table app.care_incidents enable row level security;
drop policy if exists "own care incidents" on app.care_incidents;
create policy "own care incidents" on app.care_incidents
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ========== 6) 評估規則：在寫入 face_events 時檢查並丟 Outbox ==========
create or replace function app.eval_care_rules_on_face_event()
returns trigger language plpgsql as $$
declare
  tgt_user uuid := coalesce(new.recognized_user_id, new.user_id);
  r app.care_rules%rowtype;
  win_start timestamptz;
  total int;
  hit int;
  ratio numeric;
  last_open timestamptz;
  idem_key text;
  outbox_id uuid;
begin
  if new.is_spoof is true then
    return new; -- 忽略偽造
  end if;
  if tgt_user is null then
    return new; -- 無法對應使用者
  end if;

  for r in
    select * from app.care_rules
    where (user_id = tgt_user or user_id is null)
      and active = true
  loop
    win_start := now() - make_interval(secs := r.window_sec);

    select count(*) into total
    from app.face_events
    where coalesce(recognized_user_id, user_id) = tgt_user
      and frame_ts >= win_start
      and (new.confidence is null or confidence >= r.min_confidence)
      and (is_spoof is distinct from true);

    if total = 0 then continue; end if;

    select count(*) into hit
    from app.face_events
    where coalesce(recognized_user_id, user_id) = tgt_user
      and frame_ts >= win_start
      and (new.confidence is null or confidence >= r.min_confidence)
      and (dominant_emotion = any(r.target_emotions))
      and (is_spoof is distinct from true);

    ratio := hit::numeric / greatest(total,1);

    -- 冷卻檢查：最近 cooldown_sec 內是否已有 open/近期 incident
    select max(created_at) into last_open
    from app.care_incidents
    where user_id = tgt_user and status in ('open','ack');

    if ratio >= r.min_ratio and hit >= 3 and
       (last_open is null or last_open < now() - make_interval(secs := r.cooldown_sec)) then

      -- 產生 Outbox 事件（care.trigger）
      idem_key := 'care:'||tgt_user::text||':'||r.id::text||':'||date_trunc('minute', now())::text;

      insert into app.outbox_events(event_type, status, idempotency_key,
                                    user_id, conversation_id, message_id, payload, scheduled_at)
      values ('care.trigger', 'pending', idem_key,
              tgt_user, null, null,
              jsonb_build_object(
                'rule_id', r.id,
                'target_emotions', r.target_emotions,
                'window_sec', r.window_sec,
                'ratio', ratio,
                'hit', hit,
                'total', total,
                'action', r.action
              ),
              now())
      on conflict (idempotency_key) do nothing
      returning id into outbox_id;

      -- 建立 incident（若 outbox 有成功入列）
      if outbox_id is not null then
        insert into app.care_incidents(user_id, rule_id, outbox_event_id, context)
        values (tgt_user, r.id, outbox_id,
                jsonb_build_object('ratio', ratio, 'hit', hit, 'total', total, 'window_sec', r.window_sec));
      end if;
    end if;
  end loop;

  return new;
end $$;

drop trigger if exists trg_eval_care_rules_on_face_event on app.face_events;
create trigger trg_eval_care_rules_on_face_event
after insert on app.face_events
for each row execute function app.eval_care_rules_on_face_event();



---------------------------------------------------

-- 1) 確保 schema 存在
create schema if not exists app;

-- 2) 若 app.emotion_label 尚未建立，建立它（用 DO 判斷，避免重複）
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'emotion_label' and n.nspname = 'app'
  ) then
    create type app.emotion_label as enum
      ('angry','disgust','fear','happy','sad','surprise','neutral','unknown');
  end if;
end$$;

-- 3) 現在再建 table 就不會出錯了
create table if not exists app.face_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  recognized_user_id uuid references auth.users(id) on delete set null,
  dominant_emotion app.emotion_label,  -- ✅ 這裡就找得到 enum 了
  emotion_scores jsonb,
  confidence real,
  distance real,
  is_spoof boolean,
  source text default 'camera',
  frame_ts timestamptz not null default now(),
  metadata jsonb
);

-- 常用索引 + RLS（可選）
create index if not exists idx_face_events_user_time
  on app.face_events(recognized_user_id, frame_ts desc);
create index if not exists idx_face_events_emotion
  on app.face_events(dominant_emotion);

alter table app.face_events enable row level security;

drop policy if exists "own face events" on app.face_events;
create policy "own face events" on app.face_events
for all to authenticated
using (recognized_user_id = auth.uid() or user_id = auth.uid())
with check (recognized_user_id = auth.uid() or user_id = auth.uid());




-- ========== 7) （可選）批次彙整 mood_windows：每分鐘跑一次 ==========
-- 你可用 Supabase Scheduler / n8n 定時呼叫以下簡化版彙整函式：

-- 1) 確保 schema 存在
create schema if not exists app;

-- 2) 若還沒有 emotion enum，就補上（安全重複執行）
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'emotion_label' and n.nspname = 'app'
  ) then
    create type app.emotion_label as enum
      ('angry','disgust','fear','happy','sad','surprise','neutral','unknown');
  end if;
end$$;

-- 3) 建立 mood_windows（函式會寫入這張表）
create table if not exists app.mood_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  window_sec integer not null,
  window_start timestamptz not null,
  window_end   timestamptz not null,
  samples integer not null,
  counts jsonb not null,                         -- {sad: 8, neutral: 3, ...}
  dominant_emotion app.emotion_label,
  ratio numeric,
  avg_confidence numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_mood_windows_user_time
  on app.mood_windows(user_id, window_end desc);

-- RLS（可讓本人讀寫自己的彙整；服務端用 service role 繞過）
alter table app.mood_windows enable row level security;
drop policy if exists "own mood windows" on app.mood_windows;
create policy "own mood windows" on app.mood_windows
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 4) 重新建立函式（現在引用就找得到表了）
create or replace function app.rollup_mood_windows(p_user uuid, p_window_sec int)
returns void
language sql
as $$
with win as (
  select
    date_trunc('second', now() - make_interval(secs => p_window_sec)) as s,
    now() as e
),
samp as (
  select dominant_emotion, confidence
  from app.face_events, win
  where coalesce(recognized_user_id, user_id) = p_user
    and frame_ts >= win.s and frame_ts < win.e
    and (is_spoof is distinct from true)
),
counts as (
  select dominant_emotion as emotion, count(*) as cnt
  from samp
  group by 1
),
agg as (
  select
    coalesce(sum(cnt), 0)                                                  as samples,
    coalesce(jsonb_object_agg(emotion, cnt), '{}'::jsonb)                  as counts,
    coalesce((array_agg(emotion order by cnt desc))[1]::app.emotion_label,
             'unknown')                                                    as top_emotion,
    coalesce(max(cnt)::numeric / nullif(sum(cnt), 0), 0)                   as ratio,
    coalesce((select avg(confidence)::numeric from samp), 0)               as avg_conf
  from counts
)
insert into app.mood_windows
  (user_id, window_sec, window_start, window_end, samples, counts,
   dominant_emotion, ratio, avg_confidence)
select
  p_user,
  p_window_sec,
  (select s from win),
  (select e from win),
  samples,
  counts,
  top_emotion,
  ratio,
  avg_conf
from agg;
$$;



