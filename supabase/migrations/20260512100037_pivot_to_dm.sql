-- 0037_pivot_to_dm.sql
-- Replace the transaction_comments AND transaction_reactions features with a
-- single DM (direct message) system. Both reactions and comments collapse
-- into per-friend-pair message threads: an emoji "reaction" is just a short
-- DM message whose content is the emoji and whose quoted_transaction_id
-- points at the friend's transaction. The "잔소리 on this spending" flow
-- works through a [답장] button on the friend's transaction sheet, and quick
-- emoji reactions flow through the same picker that previously toggled
-- transaction_reactions rows.
--
-- This migration is destructive: public.transaction_comments and
-- public.transaction_reactions are both dropped along with their rows.
-- CASCADE removes the dependent indexes, triggers, and RLS policies
-- introduced in 0034/0036.

-- ---------------------------------------------------------------------------
-- 1. Drop transaction_comments and transaction_reactions entirely.
-- ---------------------------------------------------------------------------
-- Remove from the realtime publication first so the publication membership
-- doesn't dangle for a beat between the drop and the next migration.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transaction_comments'
  ) then
    alter publication supabase_realtime drop table public.transaction_comments;
  end if;
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transaction_reactions'
  ) then
    alter publication supabase_realtime drop table public.transaction_reactions;
  end if;
end $$;

drop table if exists public.transaction_comments cascade;
drop table if exists public.transaction_reactions cascade;

-- The set_transaction_owner_id() function from 0034 was shared by both
-- tables; nothing references it now so drop it too. (`cascade` here is a
-- belt-and-braces in case any trigger still survives.)
drop function if exists public.set_transaction_owner_id() cascade;

-- ---------------------------------------------------------------------------
-- 3. dm_threads — one row per friend pair. Canonical ordering enforced by a
--    CHECK so we never store both (A, B) and (B, A) and a UNIQUE so callers
--    can rely on (user_a_id, user_b_id) as the natural key for ON CONFLICT.
-- ---------------------------------------------------------------------------
create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references auth.users(id) on delete cascade,
  user_b_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a_id, user_b_id),
  check (user_a_id < user_b_id)
);

-- (user_a_id, user_b_id) UNIQUE already serves as a leftmost-prefix index for
-- user_a_id lookups; only the user_b_id-only path needs a dedicated index.
create index if not exists dm_threads_user_b_idx on public.dm_threads (user_b_id);

-- ---------------------------------------------------------------------------
-- 4. dm_messages — ordered messages within a thread, optionally quoting a tx.
--    quoted_transaction_id has no ON DELETE clause: transactions use soft
--    delete (deleted_at) by convention so the FK never breaks in practice.
--    If a hard delete is ever attempted on a quoted tx Postgres will block
--    it, which matches the "hard preserve" design decision.
-- ---------------------------------------------------------------------------
create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  quoted_transaction_id uuid references public.transactions(id),
  created_at timestamptz not null default now()
);

create index if not exists dm_messages_thread_created_idx
  on public.dm_messages (thread_id, created_at);

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;

-- threads: either side of the pair can read. Insert is gated by an existing
-- friendship — strangers cannot spawn threads even if they guess a uuid.
-- After friendship dissolution the thread row is preserved (design decision
-- 5a) so the SELECT policy intentionally does not re-check friendship.
drop policy if exists "dm_threads_select" on public.dm_threads;
create policy "dm_threads_select"
  on public.dm_threads for select
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

drop policy if exists "dm_threads_insert" on public.dm_threads;
create policy "dm_threads_insert"
  on public.dm_threads for insert
  with check (
    (auth.uid() = user_a_id or auth.uid() = user_b_id)
    and exists (
      select 1 from public.friendships f
      where f.owner_id = user_a_id and f.viewer_id = user_b_id
    )
  );

-- messages: thread members can read; sender inserts their own row; sender
-- can delete their own row. quoted_transaction_id, if present, must point at
-- a live transaction the sender can SELECT (own tx or a friend's tx with the
-- show_spending_items perm). The friendship check on quotes mirrors the
-- transactions SELECT policy from 0031.
drop policy if exists "dm_messages_select" on public.dm_messages;
create policy "dm_messages_select"
  on public.dm_messages for select
  using (
    exists (
      select 1 from public.dm_threads t
      where t.id = thread_id
        and (auth.uid() = t.user_a_id or auth.uid() = t.user_b_id)
    )
  );

drop policy if exists "dm_messages_insert" on public.dm_messages;
create policy "dm_messages_insert"
  on public.dm_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.dm_threads t
      where t.id = thread_id
        and (auth.uid() = t.user_a_id or auth.uid() = t.user_b_id)
    )
    and (
      quoted_transaction_id is null
      or exists (
        select 1 from public.transactions tx
        where tx.id = quoted_transaction_id
          and tx.deleted_at is null
          and (
            tx.user_id = auth.uid()
            or exists (
              select 1 from public.friendships f
              where f.owner_id = tx.user_id
                and f.viewer_id = auth.uid()
                and f.show_spending_items = true
            )
          )
      )
    )
  );

drop policy if exists "dm_messages_delete" on public.dm_messages;
create policy "dm_messages_delete"
  on public.dm_messages for delete
  using (sender_id = auth.uid());

-- No UPDATE policy — messages are delete-and-repost, matching the policy
-- shape that comments used in 0034.

-- ---------------------------------------------------------------------------
-- 6. RPC: get_or_create_dm_thread
--    Atomically resolves the (canonical) thread for a (caller, target) pair,
--    creating it if missing. SECURITY DEFINER so it can verify friendship in
--    one round-trip and bypass the thread INSERT policy's WITH CHECK while
--    still enforcing the same friendship rule explicitly.
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_dm_thread(target uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  if v_caller is null then
    raise exception 'unauthenticated';
  end if;
  if target is null or target = v_caller then
    raise exception 'invalid target';
  end if;

  if not exists (
    select 1 from public.friendships
    where (owner_id = v_caller and viewer_id = target)
       or (owner_id = target and viewer_id = v_caller)
  ) then
    raise exception 'not friends';
  end if;

  if v_caller < target then
    v_a := v_caller;
    v_b := target;
  else
    v_a := target;
    v_b := v_caller;
  end if;

  insert into public.dm_threads (user_a_id, user_b_id)
    values (v_a, v_b)
    on conflict (user_a_id, user_b_id) do nothing
    returning id into v_id;

  if v_id is null then
    select id into v_id
      from public.dm_threads
      where user_a_id = v_a and user_b_id = v_b;
  end if;

  return v_id;
end;
$$;

grant execute on function public.get_or_create_dm_thread(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Realtime — only dm_messages is published. dm_threads changes rarely
--    (insert-only) so we don't add the publication overhead. replica identity
--    full so UPDATE/DELETE events ship the old row and client-side filters
--    survive deletes.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dm_messages'
  ) then
    alter publication supabase_realtime add table public.dm_messages;
  end if;
end $$;

alter table public.dm_messages replica identity full;
