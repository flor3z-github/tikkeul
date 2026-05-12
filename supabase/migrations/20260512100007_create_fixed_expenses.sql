-- 0007_create_fixed_expenses.sql
-- Per-user fixed expense line items. Sum replaces user_settings.fixed_expense
-- in the available-budget calculation.
--
-- - subscription_plan_id : nullable FK into the shared catalog. NULL for
--   user-entered ("직접 추가") items. ON DELETE SET NULL keeps the line item
--   if the catalog row is removed in a future migration.
-- - is_active : false = "해제" (kept in DB so toggling back ON restores the
--   amount). Only is_active = true rows are counted toward the budget.

create table if not exists public.fixed_expenses (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_plan_id uuid references public.subscription_plans(id) on delete set null,
  name text not null check (char_length(name) between 1 and 40),
  amount numeric not null check (amount >= 0),
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fixed_expenses_user_id_idx
  on public.fixed_expenses (user_id);

create index if not exists fixed_expenses_user_active_idx
  on public.fixed_expenses (user_id, is_active);

-- One row per (user, plan). Manual items (plan_id IS NULL) can repeat.
create unique index if not exists fixed_expenses_user_plan_uniq
  on public.fixed_expenses (user_id, subscription_plan_id)
  where subscription_plan_id is not null;

drop trigger if exists set_fixed_expenses_updated_at on public.fixed_expenses;
create trigger set_fixed_expenses_updated_at
before update on public.fixed_expenses
for each row
execute function public.set_updated_at();

alter table public.fixed_expenses enable row level security;

drop policy if exists "fixed_expenses_select_own" on public.fixed_expenses;
create policy "fixed_expenses_select_own"
  on public.fixed_expenses for select
  using (auth.uid() = user_id);

drop policy if exists "fixed_expenses_insert_own" on public.fixed_expenses;
create policy "fixed_expenses_insert_own"
  on public.fixed_expenses for insert
  with check (auth.uid() = user_id);

drop policy if exists "fixed_expenses_update_own" on public.fixed_expenses;
create policy "fixed_expenses_update_own"
  on public.fixed_expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "fixed_expenses_delete_own" on public.fixed_expenses;
create policy "fixed_expenses_delete_own"
  on public.fixed_expenses for delete
  using (auth.uid() = user_id);
