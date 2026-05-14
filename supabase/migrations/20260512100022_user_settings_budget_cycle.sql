-- 0022_user_settings_budget_cycle.sql
-- Adds a per-user budget cycle. cycle_mode = 'calendar' (default, current
-- behavior — 1st through end-of-month) or 'income_day' (cycle runs day N
-- through day N-1 of the next month). cycle_start_day is the day-of-month N,
-- meaningful only when cycle_mode = 'income_day'. Short-month clamping
-- (e.g. day 31 in February) is handled in application code.

alter table public.user_settings
  add column if not exists cycle_mode text not null default 'calendar'
    check (cycle_mode in ('calendar', 'income_day')),
  add column if not exists cycle_start_day smallint not null default 1
    check (cycle_start_day between 1 and 31);

comment on column public.user_settings.cycle_mode is
  '예산 집계 주기 모드: calendar=1일~말일, income_day=N일~다음달 N-1일';
comment on column public.user_settings.cycle_start_day is
  'income_day 모드일 때 사이클 시작일(1~31). 짧은 달은 코드에서 말일로 clamp.';
