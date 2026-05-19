-- 0040_add_payment_day_to_fixed_expenses.sql
-- Optional monthly payment day for fixed expenses.
--
-- payment_day semantics:
--   NULL  = unspecified
--   0     = end of month (말일) — resolved to the actual last day of the
--           current month at display/sort time
--   1..31 = that day of the month; if a month has no such day (e.g. 31 in
--           April or 30 in February), it is clamped to the last day of that
--           month at display/sort time
--
-- Stored as smallint with a check constraint instead of a separate enum so
-- the existing Insert/Update flow can keep using simple number values.

set local search_path = public;

alter table public.fixed_expenses
  add column if not exists payment_day smallint
  check (payment_day is null or payment_day between 0 and 31);
