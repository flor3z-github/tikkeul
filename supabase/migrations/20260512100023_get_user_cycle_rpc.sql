-- 0023_get_user_cycle_rpc.sql
-- Exposes only the budget cycle columns (cycle_mode, cycle_start_day) of a
-- target user to the caller when the caller is either the target themselves
-- or an accepted friend (viewer side of a friendships row owned by target).
-- monthly_income is intentionally NOT exposed.

create or replace function public.get_user_cycle(target uuid)
returns table(cycle_mode text, cycle_start_day smallint)
language sql
security definer
set search_path = public
as $$
  select us.cycle_mode, us.cycle_start_day
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
