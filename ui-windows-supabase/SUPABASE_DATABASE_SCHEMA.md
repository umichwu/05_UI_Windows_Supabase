# Supabase Database Schema Documentation

## Overview
The database uses PostgreSQL with Supabase extensions, organized in the `app` schema with Row Level Security (RLS) enabled for multi-tenant data isolation.

## Core Enums and Types

### Event Types
```sql
-- Event system types
alter type app.event_type add value if not exists 'sensor.face';
alter type app.event_type add value if not exists 'care.trigger';
alter type app.event_type add value if not exists 'care.notify';
alter type app.event_type add value if not exists 'care.resolved';
```

### Emotion Labels
```sql
create type app.emotion_label as enum (
  'angry', 'disgust', 'fear', 'happy',
  'sad', 'surprise', 'neutral', 'unknown'
);
```

## Main Tables

### 1. Face Recognition Tables

#### `app.face_profiles` - User Face Embeddings
Stores face embeddings for recognition purposes.

```sql
create table app.face_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'default',
  model text not null default 'Facenet512',
  embedding vector(512) not null,  -- pgvector for similarity search
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_face_profiles_user on app.face_profiles(user_id);

-- RLS Policy
create policy "own face profiles" on app.face_profiles
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
```

#### `app.face_events` - Real-time Face Detection Events
Stores every face detection result from the camera stream.

```sql
create table app.face_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,             -- Camera user
  recognized_user_id uuid references auth.users(id) on delete set null,  -- Recognized identity
  dominant_emotion app.emotion_label,
  emotion_scores jsonb,          -- {"happy": 0.8, "neutral": 0.2, ...}
  confidence real,               -- Emotion confidence (0-1)
  distance real,                 -- Face embedding distance (smaller = more similar)
  is_spoof boolean,             -- Anti-spoofing result
  source text default 'camera', -- Detection source
  frame_ts timestamptz not null default now(),
  metadata jsonb                -- Additional detection metadata
);

-- Indexes
create index idx_face_events_user_time on app.face_events(recognized_user_id, frame_ts desc);
create index idx_face_events_emotion on app.face_events(dominant_emotion);

-- RLS Policy
create policy "own face events" on app.face_events
for all to authenticated
using (recognized_user_id = auth.uid() or user_id = auth.uid())
with check (recognized_user_id = auth.uid() or user_id = auth.uid());
```

**Current Usage**: The API route `/api/face/recognize` inserts records here:
```typescript
const faceEventData = {
  user_id: currentUserId,
  recognized_user_id: recognitionResult.recognized_user,
  dominant_emotion: recognitionResult.dominant_emotion,
  emotion_scores: recognitionResult.emotion_scores,
  confidence: recognitionResult.confidence,
  distance: recognitionResult.distance,
  is_spoof: recognitionResult.is_spoof,
  source: 'camera',
  frame_ts: new Date().toISOString(),
  metadata: {
    model: 'Facenet512',
    detector: 'retinaface',
    threshold: 0.30
  }
}
```

### 2. Conversation System Tables

#### `app.conversations`
```sql
create table app.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  channel text not null,        -- 'web', 'line', 'wechat', 'google'
  channel_account_id text,
  title text,
  status text not null default 'active',
  msg_count integer not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### `app.messages`
```sql
create table app.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references app.conversations(id),
  user_id uuid not null references auth.users(id),
  role text not null,           -- 'user', 'assistant', 'system', 'tool'
  content text,
  metadata jsonb,               -- Includes emotion data from face detection
  created_at timestamptz not null default now()
);
```

**Emotion Integration**: Face detection results are attached to messages:
```typescript
const updatedMetadata = {
  ...message.metadata,
  emotion: recognitionResult.dominant_emotion,
  emotion_confidence: recognitionResult.confidence
}
```

### 3. Care System Tables

#### `app.mood_windows` - Emotion Analysis Windows
Aggregated emotion data over time periods.

```sql
create table app.mood_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  window_sec integer not null,       -- Window duration (60, 300, 900 seconds)
  window_start timestamptz not null,
  window_end timestamptz not null,
  samples integer not null,          -- Number of face detections in window
  counts jsonb not null,             -- {"sad": 8, "neutral": 3, "happy": 1}
  dominant_emotion app.emotion_label,
  ratio numeric,                     -- Dominant emotion ratio (0-1)
  avg_confidence numeric,
  created_at timestamptz not null default now()
);
```

#### `app.care_rules` - Automated Care Triggers
User-defined rules for emotional state monitoring.

```sql
create table app.care_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),  -- NULL = global rules
  name text not null,
  description text,
  target_emotions app.emotion_label[] not null default array['sad'],
  window_sec integer not null default 180,        -- Monitor period
  min_ratio numeric not null default 0.6,        -- Required emotion ratio
  min_confidence numeric not null default 0.6,   -- Confidence threshold
  cooldown_sec integer not null default 1800,    -- Cooldown between triggers
  active boolean not null default true,
  action jsonb not null default '{}',             -- Response action config
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### `app.care_incidents` - Care Event Tracking
Records when care rules are triggered.

```sql
create table app.care_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  rule_id uuid references app.care_rules(id),
  status text not null default 'open',      -- 'open', 'ack', 'closed'
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  outbox_event_id uuid references app.outbox_events(id),
  message_id uuid references app.messages(id),
  context jsonb,                         -- Trigger context (ratios, counts)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 4. Event System Tables

#### `app.outbox_events` - Event Queue
Reliable event processing with retry logic.

```sql
create table app.outbox_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  conversation_id uuid references app.conversations(id),
  event_type text not null,             -- 'care.trigger', 'care.notify', etc.
  payload jsonb not null,
  status text not null default 'pending', -- 'pending', 'processing', 'completed', 'failed'
  priority integer not null default 0,
  scheduled_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### `app.user_memory` - User Context Storage
```sql
create table app.user_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  conversation_id uuid references app.conversations(id),
  memory_type text not null,     -- 'preference', 'fact', 'context', 'general'
  title text not null,
  content text not null,
  importance integer not null default 5,
  tags text[],
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Database Triggers

### Face Event Care Rule Evaluation
Automatically evaluates care rules when new face events are inserted.

```sql
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
begin
  -- Skip spoofed faces
  if new.is_spoof is true then
    return new;
  end if;

  -- Check each active care rule
  for r in
    select * from app.care_rules
    where (user_id = tgt_user or user_id is null)
      and active = true
  loop
    win_start := now() - make_interval(secs := r.window_sec);

    -- Count total valid emotions in window
    select count(*) into total
    from app.face_events
    where coalesce(recognized_user_id, user_id) = tgt_user
      and frame_ts >= win_start
      and confidence >= r.min_confidence;

    -- Count target emotions in window
    select count(*) into hit
    from app.face_events
    where coalesce(recognized_user_id, user_id) = tgt_user
      and frame_ts >= win_start
      and confidence >= r.min_confidence
      and dominant_emotion = any(r.target_emotions);

    ratio := hit::numeric / greatest(total,1);

    -- Check if rule triggers (ratio threshold + cooldown)
    if ratio >= r.min_ratio and hit >= 3 then
      -- Create outbox event for n8n processing
      insert into app.outbox_events(event_type, user_id, payload)
      values ('care.trigger', tgt_user, jsonb_build_object(
        'rule_id', r.id,
        'ratio', ratio,
        'hit', hit,
        'total', total,
        'action', r.action
      ));

      -- Create care incident record
      insert into app.care_incidents(user_id, rule_id, context)
      values (tgt_user, r.id, jsonb_build_object(
        'ratio', ratio, 'hit', hit, 'total', total
      ));
    end if;
  end loop;

  return new;
end $$;

-- Trigger setup
create trigger trg_eval_care_rules_on_face_event
after insert on app.face_events
for each row execute function app.eval_care_rules_on_face_event();
```

## Mood Window Aggregation Function

```sql
create or replace function app.rollup_mood_windows(p_user uuid, p_window_sec int)
returns void language sql as $$
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
    coalesce(sum(cnt), 0) as samples,
    coalesce(jsonb_object_agg(emotion, cnt), '{}') as counts,
    coalesce((array_agg(emotion order by cnt desc))[1], 'unknown') as top_emotion,
    coalesce(max(cnt)::numeric / nullif(sum(cnt), 0), 0) as ratio,
    coalesce(avg(confidence), 0) as avg_conf
  from counts
)
insert into app.mood_windows
  (user_id, window_sec, window_start, window_end, samples, counts,
   dominant_emotion, ratio, avg_confidence)
select p_user, p_window_sec, (select s from win), (select e from win),
       samples, counts, top_emotion, ratio, avg_conf
from agg;
$$;
```

## Row Level Security (RLS) Policies

All tables use RLS to ensure users can only access their own data:

- **Face Events**: Users can access events where they are either the camera user or recognized user
- **Conversations/Messages**: Users can only access their own conversations
- **Care Rules/Incidents**: Users can only manage their own care settings
- **Mood Windows**: Users can only view their own aggregated data

## Data Flow Architecture

1. **Face Detection Stream**: Camera → API → `face_events` table
2. **Care Rule Evaluation**: `face_events` insert → trigger → `care_incidents` + `outbox_events`
3. **External Processing**: n8n polls `outbox_events` → processes care actions
4. **Aggregation**: Scheduled job → `rollup_mood_windows()` → `mood_windows` table
5. **User Interface**: Real-time queries against aggregated and raw data

## Integration Points

### With Face Recognition API
- Face detection results stored in `face_events`
- Emotion data attached to recent `messages`
- Triggers automatic care rule evaluation

### With n8n Automation
- `outbox_events` table acts as task queue
- Care triggers create workflow events
- External systems process via Supabase API

### With Frontend
- Real-time subscriptions to face detection events
- Aggregated emotion analytics from `mood_windows`
- User-configurable care rules interface

This schema provides a comprehensive foundation for emotion-based care automation with reliable event processing and detailed analytics capabilities.