-- 20260512100057_friend_savings_visibility.sql
-- Per-friend savings (돈모으기) visibility — Phase 2b Slice 2.
--
-- Mirrors the fixed-expense scope (0031): two boolean flags on `friendships`
-- the owner can toggle per friend, with the same total/items split. Savings is
-- as private as income, so BOTH default FALSE — existing friends see nothing
-- until the owner opts in. monthly_income is still NEVER exposed.
--
-- Divergence from the fixed pattern (deliberate): fixed_expenses uses a friend
-- RLS SELECT policy, but savings_plans carries `opening_balance` (accumulated
-- wealth) and `goal_amount` — more sensitive than a monthly amount. A row-level
-- RLS grant would expose those columns to any friend with the items flag via a
-- direct REST select. So we keep savings_plans RLS OWN-ONLY and expose the
-- friend paths through two SECURITY DEFINER RPCs that return only the columns
-- the dashboard needs (column-level control). Both re-check the perm flag
-- themselves because SECURITY DEFINER bypasses RLS.

-- ---------------------------------------------------------------------------
-- 1. Two boolean perm columns on friendships (default false = private)
-- ---------------------------------------------------------------------------
alter table public.friendships
  add column if not exists show_savings_total boolean not null default false,
  add column if not exists show_savings_items boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Total-only path — 친구가 보는 「이번 달 모은 돈」
-- ---------------------------------------------------------------------------
-- The ongoing filter mirrors lib/utils/savings.ts::isOngoing exactly so the
-- number a friend sees equals the owner's hero "이번 달 모은 돈" (thisMonthSaved):
-- active, started, not matured. KST date (now() at time zone 'Asia/Seoul') so it
-- agrees with nowInSeoul() and never drifts a day under UTC. amount NULL rows are
-- skipped by sum(); coalesce guards the all-null/none case.
--
-- Coupling enforced IN THE DATA LAYER, not just the toggle UI: savings rides on
-- the shared spending surface, so the total requires show_savings_total AND
-- show_spending_total. Without this AND, a stale show_savings_total left true
-- after spending was turned off would still leak via a direct RPC call (the
-- toggle UI only disables the switch, it doesn't clear the stored flag).
create or replace function public.get_friend_savings_total(target uuid)
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(sp.amount), 0)
  from public.savings_plans sp
  where sp.user_id = target
    and sp.is_active = true
    and sp.start_date <= (now() at time zone 'Asia/Seoul')::date
    and (sp.maturity_date is null
         or sp.maturity_date >= (now() at time zone 'Asia/Seoul')::date)
    and exists (
      select 1 from public.friendships f
      where f.owner_id = target
        and f.viewer_id = auth.uid()
        and f.show_savings_total = true
        and f.show_spending_total = true
    );
$$;

revoke all on function public.get_friend_savings_total(uuid) from public;
grant execute on function public.get_friend_savings_total(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Items path — 친구 캘린더의 적립일 마커
-- ---------------------------------------------------------------------------
-- Returns ONLY the columns the calendar marker needs — no opening_balance,
-- goal_amount, or is_active leak. Active rows only; the per-cycle lifespan bound
-- (depositsOnDate) is applied in JS like the own path. Coupling enforced in the
-- data layer: requires show_savings_items AND show_spending_items (the markers
-- live on the spending calendar, which only renders with spending items) — so a
-- stale show_savings_items can't leak after spending items was turned off.
create or replace function public.get_friend_savings_items(target uuid)
returns table (
  id uuid,
  name text,
  amount numeric,
  payment_day smallint,
  start_date date,
  maturity_date date
)
language sql
security definer
set search_path = public
as $$
  select sp.id, sp.name, sp.amount, sp.payment_day, sp.start_date, sp.maturity_date
  from public.savings_plans sp
  where sp.user_id = target
    and sp.is_active = true
    and exists (
      select 1 from public.friendships f
      where f.owner_id = target
        and f.viewer_id = auth.uid()
        and f.show_savings_items = true
        and f.show_spending_items = true
    );
$$;

revoke all on function public.get_friend_savings_items(uuid) from public;
grant execute on function public.get_friend_savings_items(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
-- - savings_plans INSERT/UPDATE/DELETE + SELECT RLS stay OWN-ONLY (0055). No
--   friend RLS policy is added; friend reads go only through the two RPCs above.
-- - user_settings / monthly_income remain unexposed. Nothing here derives income.
-- - Realtime is not added for savings_plans; the existing transactions watcher's
--   router.refresh() re-runs friend-mode sections, and savings changes are rare.
