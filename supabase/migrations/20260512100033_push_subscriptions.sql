-- 0033_push_subscriptions.sql
-- Web Push (RFC 8030) subscription storage + friend-spending notification opt-in.
-- Subscriptions are one row per device (browser + UA). endpoint is the natural
-- key so it carries the UNIQUE constraint and lets us upsert on resubscribe.
-- friend_spending_notifications defaults to false: pushes are only sent for
-- users who have explicitly toggled the setting on in /settings.

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Owners can read/insert/update/delete their own subscriptions. The Edge
-- Function uses the service_role key to bypass RLS when fetching recipients.
drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_settings.friend_spending_notifications
-- ---------------------------------------------------------------------------
alter table public.user_settings
  add column if not exists friend_spending_notifications boolean not null default false;

comment on column public.user_settings.friend_spending_notifications is
  '친구가 소비를 추가했을 때 푸시 알림을 받을지 여부. 기본 false.';
