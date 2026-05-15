-- 0031_friend_visibility_scope.sql
-- Per-friend visibility scope. The owner of a friendship row (`owner_id`)
-- controls which of their data the viewer (`viewer_id`) is allowed to see.
-- Four independent boolean flags, defaults preserve current behavior:
--   - show_spending_total : aggregate-only "총 소비" card on friend dashboard
--   - show_spending_items : transactions list + calendar grid
--   - show_fixed_total    : aggregate-only "친구의 고정지출 합계" card (NEW)
--   - show_fixed_items    : per-row fixed_expenses list (NEW)
--
-- Privacy invariant: when only the TOTAL flag is granted (items=false), the
-- viewer must NOT be able to read individual rows. We achieve this by gating
-- row-level access with RLS (items flag) and exposing totals through
-- SECURITY DEFINER RPCs (which run as the function owner and bypass RLS).
-- A simpler `items OR total` RLS would let the viewer pull rows directly via
-- the Supabase REST endpoint whenever total is granted.

-- ---------------------------------------------------------------------------
-- 1. Add the four boolean perm columns to friendships
-- ---------------------------------------------------------------------------
-- NOT NULL DEFAULT backfills existing rows. Defaults match the pre-feature
-- behavior: spending visible to friends, fixed expenses private.
alter table public.friendships
  add column if not exists show_spending_total boolean not null default true,
  add column if not exists show_spending_items boolean not null default true,
  add column if not exists show_fixed_total    boolean not null default false,
  add column if not exists show_fixed_items    boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Replace transactions SELECT policy: gate friend branch on items flag
-- ---------------------------------------------------------------------------
drop policy if exists "transactions_select_own_or_friend" on public.transactions;
create policy "transactions_select_own_or_friend"
  on public.transactions for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.friendships
      where owner_id = public.transactions.user_id
        and viewer_id = auth.uid()
        and show_spending_items = true
    )
  );

-- ---------------------------------------------------------------------------
-- 3. fixed_expenses: introduce friend SELECT gated on the items flag
-- ---------------------------------------------------------------------------
-- profiles SELECT is intentionally left unchanged — the nickname is needed
-- everywhere the friend list / switcher / banner renders, and gating it per
-- perm buys no privacy since the pairing already exists.
drop policy if exists "fixed_expenses_select_own" on public.fixed_expenses;
drop policy if exists "fixed_expenses_select_own_or_friend" on public.fixed_expenses;
create policy "fixed_expenses_select_own_or_friend"
  on public.fixed_expenses for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.friendships
      where owner_id = public.fixed_expenses.user_id
        and viewer_id = auth.uid()
        and show_fixed_items = true
    )
  );

-- ---------------------------------------------------------------------------
-- 4. SECURITY DEFINER RPCs for total-only paths
-- ---------------------------------------------------------------------------
-- Both functions check the perm flag themselves because SECURITY DEFINER
-- bypasses RLS. They accept either of the two relevant flags so the caller
-- can use a single RPC whether items are visible (sum could also be computed
-- client-side) or only total is granted (RPC is the only path).

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

create or replace function public.get_friend_fixed_total(target uuid)
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(fe.amount), 0)
  from public.fixed_expenses fe
  where fe.user_id = target
    and fe.is_active = true
    and exists (
      select 1 from public.friendships f
      where f.owner_id = target
        and f.viewer_id = auth.uid()
        and (f.show_fixed_total = true or f.show_fixed_items = true)
    );
$$;

revoke all on function public.get_friend_fixed_total(uuid) from public;
grant execute on function public.get_friend_fixed_total(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
-- - INSERT/UPDATE/DELETE policies on transactions and fixed_expenses remain
--   owner-only. Friends never mutate the owner's data.
-- - user_settings is unchanged: monthly_income is NEVER exposed to friends,
--   not even indirectly. There is no RPC that returns income.
-- - Realtime publication for fixed_expenses is intentionally not added in v1.
--   The existing transactions realtime watcher already calls router.refresh()
--   which re-runs all dashboard sections including the new fixed section.
--   Owners typically edit fixed expenses rarely so push freshness is low
--   value. If this becomes a need:
--     alter publication supabase_realtime add table public.fixed_expenses;
--     alter table public.fixed_expenses replica identity full;
