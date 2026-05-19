-- 0041_dm_read_tracking.sql
-- Add per-side read tracking to dm_threads and the two RPCs that power the
-- DM index page (`get_my_dm_index`) and the per-thread read marker
-- (`mark_dm_thread_read`).

-- ---------------------------------------------------------------------------
-- 1. Schema: last_read_at columns on dm_threads.
--    One column per side keeps the row 1:1-shaped (group DMs are out of
--    scope per DESIGN.md §12.8); a separate `dm_reads` table would buy us
--    nothing today and cost an extra join on every index render.
-- ---------------------------------------------------------------------------
alter table public.dm_threads
  add column if not exists last_read_at_user_a timestamptz,
  add column if not exists last_read_at_user_b timestamptz;

-- Backfill existing threads so launch day shows 0 unread. Without this,
-- every historical message would surface as unread the first time a user
-- opens the index, which is misleading because they were already "seen".
update public.dm_threads
   set last_read_at_user_a = coalesce(last_read_at_user_a, now()),
       last_read_at_user_b = coalesce(last_read_at_user_b, now());

-- ---------------------------------------------------------------------------
-- 2. RPC: mark_dm_thread_read.
--    Sets the caller-side last_read_at column to now() for the named thread.
--    SECURITY DEFINER lets us do the per-side branching without granting a
--    column-broad UPDATE policy on dm_threads (which would let either party
--    overwrite the other side's read state).
-- ---------------------------------------------------------------------------
create or replace function public.mark_dm_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_a uuid;
  v_b uuid;
begin
  if v_caller is null then
    raise exception 'unauthenticated';
  end if;

  select user_a_id, user_b_id
    into v_a, v_b
    from public.dm_threads
   where id = p_thread_id;

  if v_a is null then
    raise exception 'thread not found';
  end if;

  if v_caller = v_a then
    update public.dm_threads
       set last_read_at_user_a = now()
     where id = p_thread_id;
  elsif v_caller = v_b then
    update public.dm_threads
       set last_read_at_user_b = now()
     where id = p_thread_id;
  else
    raise exception 'not a thread member';
  end if;
end;
$$;

grant execute on function public.mark_dm_thread_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. RPC: get_my_dm_index.
--    Returns one row per friend the caller is paired with, including the
--    optional thread, its latest message (if any), and the caller-side
--    unread count. Friends without a thread yet appear with nulls + 0
--    unread so the index UI can still render their "메시지 없음" row.
--    Ordering: most recent activity first; threads with no message fall
--    through to a nickname tiebreak so the list stays stable.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_dm_index()
returns table (
  friend_id uuid,
  nickname text,
  thread_id uuid,
  last_message_id uuid,
  last_message_content text,
  last_message_sender_id uuid,
  last_message_at timestamptz,
  unread bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'unauthenticated';
  end if;

  return query
  with friend_ids as (
    select viewer_id as id
      from public.friendships
     where owner_id = v_caller
  ),
  threads as (
    select t.id,
           case when t.user_a_id = v_caller then t.user_b_id
                else t.user_a_id end as other_id,
           case when t.user_a_id = v_caller then t.last_read_at_user_a
                else t.last_read_at_user_b end as my_last_read
      from public.dm_threads t
     where t.user_a_id = v_caller or t.user_b_id = v_caller
  ),
  last_msgs as (
    select distinct on (m.thread_id)
           m.thread_id,
           m.id          as last_message_id,
           m.content     as last_message_content,
           m.sender_id   as last_message_sender_id,
           m.created_at  as last_message_at
      from public.dm_messages m
      join threads th on th.id = m.thread_id
     order by m.thread_id, m.created_at desc
  ),
  unreads as (
    select m.thread_id, count(*)::bigint as unread
      from public.dm_messages m
      join threads th on th.id = m.thread_id
     where m.sender_id <> v_caller
       and (th.my_last_read is null or m.created_at > th.my_last_read)
     group by m.thread_id
  )
  select
    f.id                                          as friend_id,
    coalesce(p.display_name, '이름 없음')          as nickname,
    th.id                                          as thread_id,
    lm.last_message_id,
    lm.last_message_content,
    lm.last_message_sender_id,
    lm.last_message_at,
    coalesce(u.unread, 0)                          as unread
  from friend_ids f
  left join threads th on th.other_id = f.id
  left join public.profiles p on p.id = f.id
  left join last_msgs lm on lm.thread_id = th.id
  left join unreads u on u.thread_id = th.id
  order by lm.last_message_at desc nulls last,
           coalesce(p.display_name, '이름 없음') asc;
end;
$$;

grant execute on function public.get_my_dm_index() to authenticated;
