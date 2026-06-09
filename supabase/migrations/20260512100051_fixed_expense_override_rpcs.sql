-- 20260512100051_fixed_expense_override_rpcs.sql
-- Cycle-aware effective-amount RPCs. These are the SINGLE source of truth for
-- COALESCE(override.amount, fixed_expenses.amount): both own mode and friend
-- mode call them, so the effective-amount rule lives in exactly one place.
--
-- Both are SECURITY DEFINER (bypass RLS) and therefore re-check the friendship
-- perm flags in their own body, mirroring get_friend_fixed_total / get_user_categories.
--
-- Privacy model:
--   * Base amounts / base total stay visible to a friend EXACTLY as before this
--     feature — the row/total gate is the same show_fixed_items / show_fixed_total
--     check, with NO cycle restriction. So friend fixed visibility never
--     regresses (an old cycle still shows the friend's base fixed expenses).
--   * The per-cycle OVERRIDE is the new signal. For a FRIEND caller it is applied
--     only when the requested cycle_anchor is within a recent window
--     (current label month -2 .. +1); for anchors outside that window the LEFT
--     JOIN simply doesn't match, so the friend falls back to the BASE amount
--     (never an empty row, never a wrong number). This caps raw-RPC enumeration
--     of the owner's per-cycle amount HISTORY to a few recent cycles without
--     re-implementing the Model B cycle engine in plpgsql. The OWNER
--     (target = auth.uid()) is unbounded so the own dashboard can navigate to
--     arbitrary past/future cycles and still see its own overrides.
--   * base_amount and is_overridden are returned ONLY to the owner; a friend
--     gets base_amount = NULL and is_overridden = false, so the friend sees the
--     effective number but neither the pre-override base nor the fact that this
--     cycle was adjusted.

-- ---------------------------------------------------------------------------
-- 1. get_fixed_effective_items: per-row effective amounts for one cycle
-- ---------------------------------------------------------------------------
-- Used by: own-mode dashboard (budget total + calendar markers) and the
-- friend ITEMS path (show_fixed_items).
create or replace function public.get_fixed_effective_items(
  target uuid,
  cycle_anchor text
)
returns table (
  id uuid,
  subscription_plan_id uuid,
  name text,
  plan_name text,
  amount numeric,
  base_amount numeric,
  category text,
  payment_day smallint,
  is_overridden boolean
)
language sql
security definer
set search_path = public
as $$
  select
    fe.id,
    fe.subscription_plan_id,
    fe.name,
    fe.plan_name,
    coalesce(o.amount, fe.amount) as amount,
    case when target = auth.uid() then fe.amount else null end as base_amount,
    fe.category,
    fe.payment_day,
    case when target = auth.uid() then (o.id is not null) else false end as is_overridden
  from public.fixed_expenses fe
  left join public.fixed_expense_overrides o
    on o.fixed_expense_id = fe.id
   and o.user_id = fe.user_id
   and o.cycle_anchor = get_fixed_effective_items.cycle_anchor
   -- Friends only get the override applied for a recent cycle window; outside
   -- it the join misses and the row falls back to the base amount.
   and (
     target = auth.uid()
     or to_date(get_fixed_effective_items.cycle_anchor || '-01', 'YYYY-MM-DD')
        between (date_trunc('month', (now() at time zone 'Asia/Seoul'))::date - interval '2 months')
            and (date_trunc('month', (now() at time zone 'Asia/Seoul'))::date + interval '1 month')
   )
  where fe.user_id = target
    and fe.is_active = true
    and (
      target = auth.uid()
      or exists (
        select 1 from public.friendships f
        where f.owner_id = target
          and f.viewer_id = auth.uid()
          and f.show_fixed_items = true
      )
    );
$$;

revoke all on function public.get_fixed_effective_items(uuid, text) from public;
grant execute on function public.get_fixed_effective_items(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_friend_fixed_total: cycle-aware total (overload of the 0031 1-arg fn)
-- ---------------------------------------------------------------------------
-- Used by the friend TOTAL-ONLY path (show_fixed_total, items off). Coexists
-- with the legacy 1-arg get_friend_fixed_total(uuid) during deploy; the 1-arg
-- version is dropped in 0052 after the code switches to this 2-arg form.
create or replace function public.get_friend_fixed_total(
  target uuid,
  cycle_anchor text
)
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(coalesce(o.amount, fe.amount)), 0)
  from public.fixed_expenses fe
  left join public.fixed_expense_overrides o
    on o.fixed_expense_id = fe.id
   and o.user_id = fe.user_id
   and o.cycle_anchor = get_friend_fixed_total.cycle_anchor
   and (
     target = auth.uid()
     or to_date(get_friend_fixed_total.cycle_anchor || '-01', 'YYYY-MM-DD')
        between (date_trunc('month', (now() at time zone 'Asia/Seoul'))::date - interval '2 months')
            and (date_trunc('month', (now() at time zone 'Asia/Seoul'))::date + interval '1 month')
   )
  where fe.user_id = target
    and fe.is_active = true
    and (
      target = auth.uid()
      or exists (
        select 1 from public.friendships f
        where f.owner_id = target
          and f.viewer_id = auth.uid()
          and (f.show_fixed_total = true or f.show_fixed_items = true)
      )
    );
$$;

revoke all on function public.get_friend_fixed_total(uuid, text) from public;
grant execute on function public.get_friend_fixed_total(uuid, text) to authenticated;
