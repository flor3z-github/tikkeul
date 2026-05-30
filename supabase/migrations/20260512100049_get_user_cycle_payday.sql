-- 20260512100049_get_user_cycle_payday.sql
-- M3 (Budget cycle Model B) — rewrite get_user_cycle to return
-- (payday smallint, payroll_rule text) instead of (cycle_mode, cycle_start_day).
--
-- Friend cycles are computed in JS from these two values + the public holidays
-- table, so the RPC only needs to expose payday + payroll_rule. monthly_income
-- (and everything derived from it) is FOREVER private — the SELECT list below
-- must never grow beyond these two columns.
--
-- The friendship gate is UNCHANGED: a caller sees a target's cycle iff they are
-- the target themselves OR an accepted friend (viewer side of a friendships row
-- owned by target).
--
-- BREAKING return-type change: `create or replace function` cannot alter an OUT
-- signature in place, so we DROP first, then CREATE. Code callers
-- (app/dashboard/page.tsx) and lib/supabase/database.types.ts must ship the
-- matching read shape. Deployment order: M1 -> M2 -> code update -> M3 (or an
-- atomic migration + code release).

drop function if exists public.get_user_cycle(uuid);

create or replace function public.get_user_cycle(target uuid)
returns table(payday smallint, payroll_rule text)
language sql
security definer
set search_path = public
as $$
  select us.payday, us.payroll_rule
  from public.user_settings us
  where us.user_id = target
    and (
      us.user_id = auth.uid()
      or exists (
        select 1 from public.friendships f
        where f.owner_id = target and f.viewer_id = auth.uid()
      )
    );
$$;

revoke all on function public.get_user_cycle(uuid) from public;
grant execute on function public.get_user_cycle(uuid) to authenticated;
