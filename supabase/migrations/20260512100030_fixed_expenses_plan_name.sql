-- 0030_fixed_expenses_plan_name.sql
-- Add optional plan_name to fixed_expenses so manual ("직접 추가") items can
-- carry a secondary plan label, matching the catalog rows' two-line display.

set local search_path = public;

alter table public.fixed_expenses
  add column if not exists plan_name text
  check (plan_name is null or char_length(plan_name) between 1 and 40);
