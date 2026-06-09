-- 20260512100053_fixed_expenses_amount_nullable.sql
-- Allow adding a fixed expense whose amount is not yet known ("금액 미입력").
-- NULL amount = the user added the recurring item but will fill the amount in
-- later. NULL is used (not a 0 sentinel) so it stays distinguishable from a
-- genuinely free 0원 item. A NULL-amount expense contributes 0 to every total
-- (SQL sum() ignores NULL; client reducers coalesce ?? 0) and renders as
-- "금액 미입력" until filled.
alter table public.fixed_expenses
  alter column amount drop not null;

-- Replace the >= 0 CHECK so it tolerates NULL. (A column CHECK already passes
-- on NULL, but the original 0007 constraint was written as `amount >= 0`; we
-- make the intent explicit.)
alter table public.fixed_expenses
  drop constraint if exists fixed_expenses_amount_check;
alter table public.fixed_expenses
  add constraint fixed_expenses_amount_check
  check (amount is null or amount >= 0);
