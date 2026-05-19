-- 0038_transactions_is_private.sql
-- Per-transaction privacy flag. Default false (public) so existing rows stay
-- visible to friends with show_spending_items=true. When true, the row is
-- hidden from friends entirely — both in the items list (RLS gate) and the
-- aggregate total (SECURITY DEFINER RPC filter).
--
-- Owner always sees their own rows including private ones via auth.uid()
-- branch of the SELECT policy.

-- ---------------------------------------------------------------------------
-- 1. Column
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column if not exists is_private boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Replace transactions SELECT policy: friend branch also requires
--    is_private = false
-- ---------------------------------------------------------------------------
drop policy if exists "transactions_select_own_or_friend" on public.transactions;
create policy "transactions_select_own_or_friend"
  on public.transactions for select
  using (
    auth.uid() = user_id
    or (
      is_private = false
      and exists (
        select 1
        from public.friendships
        where owner_id = public.transactions.user_id
          and viewer_id = auth.uid()
          and show_spending_items = true
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. get_friend_spending_total: exclude private transactions so friend-visible
--    total matches the sum of items they can actually see.
-- ---------------------------------------------------------------------------
create or replace function public.get_friend_spending_total(
  target uuid,
  start_iso timestamptz,
  end_iso timestamptz
)
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(t.amount), 0)
  from public.transactions t
  where t.user_id = target
    and t.deleted_at is null
    and t.is_private = false
    and t.spent_at >= start_iso
    and t.spent_at <  end_iso
    and exists (
      select 1 from public.friendships f
      where f.owner_id = target
        and f.viewer_id = auth.uid()
        and (f.show_spending_total = true or f.show_spending_items = true)
    );
$$;

revoke all on function public.get_friend_spending_total(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_friend_spending_total(uuid, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
-- - INSERT/UPDATE/DELETE policies unchanged — owner-only, fine for is_private.
-- - dm_messages_insert with_check has its own exists subquery against
--   transactions. RLS applies in WITH CHECK subqueries, so the new SELECT
--   policy already blocks friends from quoting private transactions; no
--   change needed in 0037.
-- - DM history: if a previously-quoted transaction is later marked private,
--   the friend's DM page can no longer SELECT the tx row, and the existing
--   "deleted snapshot" fallback in app/dm/[friendId]/page.tsx kicks in. This
--   is the intended behavior — turning private hides everywhere.
