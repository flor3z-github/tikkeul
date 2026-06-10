-- ---------------------------------------------------------------------------
-- Message-to-message quote reply.
--
-- Adds reply_to_id on dm_messages so a message can quote ANOTHER message in the
-- same thread. Distinct from quoted_transaction_id (0037), which quotes a spend.
--
-- reply_to_id is a PLAIN uuid (NO foreign key) on purpose. dm_messages are
-- HARD-deleted (the dm_messages_delete policy lets a sender delete their own
-- row). With an FK + ON DELETE SET NULL the column would be nulled when the
-- target is deleted and the reply's context would vanish; with an FK + RESTRICT
-- the target could never be deleted. We instead keep the (possibly dangling) id
-- and resolve it at read time: page.tsx self-fetches the snippet and renders a
-- "삭제된 메시지" stub when the target row is gone. Same-thread integrity is
-- enforced at INSERT time by the RLS policy below — the only moment it matters.
-- ---------------------------------------------------------------------------
alter table public.dm_messages
  add column if not exists reply_to_id uuid;

-- Same-thread check for the INSERT policy, as a SECURITY DEFINER function.
-- A naive `exists (select 1 from public.dm_messages r where ...)` INLINE in the
-- policy makes the policy read dm_messages under RLS, which Postgres rejects at
-- runtime with "infinite recursion detected in policy for relation dm_messages"
-- (the relation's policies re-enter while already evaluating a policy on it).
-- Running the lookup in a SECURITY DEFINER function bypasses RLS on the inner
-- read, breaking the cycle. Returns a boolean only — no row data is exposed.
create or replace function public.dm_reply_target_in_thread(p_reply_to uuid, p_thread uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.dm_messages r
    where r.id = p_reply_to and r.thread_id = p_thread
  );
$$;

grant execute on function public.dm_reply_target_in_thread(uuid, uuid) to authenticated;

-- Re-create the INSERT policy to also validate reply_to_id: a reply target must
-- be a message that lives in the SAME thread as the new message. Everything
-- above the final reply_to_id block is an exact copy of 0037's policy.
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
    and (
      reply_to_id is null
      or public.dm_reply_target_in_thread(reply_to_id, thread_id)
    )
  );
