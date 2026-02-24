-- Give Me Water - Supabase Schema
-- Required extension for UUID generation
create extension if not exists pgcrypto;

create table if not exists public.profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    timezone text default 'UTC',
    settings_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.hydration_events (
    event_id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    timestamp_utc timestamptz not null,
    effective_day_key text not null,
    drink_id text not null,
    raw_amount_ml integer not null,
    hydration_amount_ml integer not null,
    source text not null default 'manual',
    created_at timestamptz not null default now()
);

create index if not exists idx_hydration_events_user_day
    on public.hydration_events(user_id, effective_day_key);

create table if not exists public.monthly_summaries (
    summary_id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    month_key text not null,
    average_intake_ml integer not null default 0,
    days_tracked integer not null default 0,
    days_met_goal integer not null default 0,
    completion_rate integer not null default 0,
    created_at timestamptz not null default now(),
    unique (user_id, month_key)
);

create table if not exists public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    user_agent text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.hydration_events enable row level security;
alter table public.monthly_summaries enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
    on public.profiles for select
    using (auth.uid() = user_id);

drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_upsert_own"
    on public.profiles for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "events_select_own" on public.hydration_events;
create policy "events_select_own"
    on public.hydration_events for select
    using (auth.uid() = user_id);

drop policy if exists "events_insert_own" on public.hydration_events;
create policy "events_insert_own"
    on public.hydration_events for insert
    with check (auth.uid() = user_id);

drop policy if exists "events_update_own" on public.hydration_events;
create policy "events_update_own"
    on public.hydration_events for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "events_delete_own" on public.hydration_events;
create policy "events_delete_own"
    on public.hydration_events for delete
    using (auth.uid() = user_id);

drop policy if exists "monthly_select_own" on public.monthly_summaries;
create policy "monthly_select_own"
    on public.monthly_summaries for select
    using (auth.uid() = user_id);

drop policy if exists "monthly_upsert_own" on public.monthly_summaries;
create policy "monthly_upsert_own"
    on public.monthly_summaries for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own"
    on public.push_subscriptions for select
    using (auth.uid() = user_id);

drop policy if exists "push_upsert_own" on public.push_subscriptions;
create policy "push_upsert_own"
    on public.push_subscriptions for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
