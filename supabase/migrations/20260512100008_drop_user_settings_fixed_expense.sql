-- 0008_drop_user_settings_fixed_expense.sql
-- The single-number user_settings.fixed_expense column is replaced by per-item
-- rows in public.fixed_expenses (see 0007). Before dropping the column we
-- migrate any existing value into a single "기타 고정지출" line item so the
-- user's budget calculation stays stable.
--
-- ⚠️  DESTRUCTIVE: this drops a column. Run 0007 FIRST and verify
-- public.fixed_expenses exists before running this migration.

-- 1) Migrate non-zero existing values to per-user line items.
--    is_active defaults to true and subscription_plan_id defaults to NULL,
--    but we set them explicitly to make the intent obvious in the migration.
insert into public.fixed_expenses
  (id, user_id, subscription_plan_id, name, amount, category, is_active)
select gen_random_uuid(), user_id, null, '기타 고정지출', fixed_expense, null, true
from public.user_settings
where fixed_expense > 0;

-- 2) Drop the now-redundant column.
alter table public.user_settings
  drop column if exists fixed_expense;
