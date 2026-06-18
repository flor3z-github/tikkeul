-- 20260512100055_create_savings_plans.sql
-- Per-user savings / investment plans for the new "돈모으기" tab.
--
-- Savings was previously buried inside `fixed_expenses` (e.g. 청년희망적금, ISA)
-- with no marker distinguishing it from a real recurring cost. A separate table
-- is used (not a `kind` column on fixed_expenses) so every existing
-- fixed_expenses reader — the dashboard budget total, get_friend_fixed_total,
-- the stats cycle-breakdown, the override RPCs — stays untouched and cannot
-- silently double-count savings as fixed cost. Only the future dashboard
-- "나간 돈" 3-split aggregate unions the two tables.
--
-- Columns mirror fixed_expenses where they overlap (amount = monthly
-- contribution, payment_day, is_active) and add the savings-only fields:
--   - start_date    : first-deposit month. Accrual is derived from this, NOT a
--                     stored current_amount (see lib/utils/savings.ts).
--   - goal_amount   : target amount (달성형 목표). NULL = 자유적립/투자 (섹션 A).
--   - maturity_date : 적금 만기일. NULL = open-ended.
-- A row is a "달성형 목표" (섹션 B, progress bar) when goal_amount OR
-- maturity_date is set; otherwise it is "투자·자유 적립" (섹션 A, numbers only).
--
-- Friend exposure is intentionally OFF for now (RLS is owner-only, savings is
-- never joined into any friend RPC). A future public/private permission toggle
-- can layer on without touching this table's shape.

create table if not exists public.savings_plans (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  -- Monthly contribution. NULL = "금액 미입력" (mirrors fixed_expenses); a NULL
  -- amount contributes 0 to every total and accrues nothing until filled.
  amount numeric check (amount is null or amount >= 0),
  -- Monthly deposit day. Same convention as fixed_expenses.payment_day:
  -- NULL = unset, 0 = 말일, 1..31 = that day (clamped to month length).
  payment_day smallint check (payment_day is null or payment_day between 0 and 31),
  -- First-deposit month. Accrued amount = monthly × deposits since this date.
  start_date date not null default current_date,
  -- Target amount for 달성형 목표. NULL = 자유적립/투자 (no goal).
  goal_amount numeric check (goal_amount is null or goal_amount >= 0),
  -- 적금 만기일. NULL = open-ended.
  maturity_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists savings_plans_user_id_idx
  on public.savings_plans (user_id);

create index if not exists savings_plans_user_active_idx
  on public.savings_plans (user_id, is_active);

drop trigger if exists set_savings_plans_updated_at on public.savings_plans;
create trigger set_savings_plans_updated_at
before update on public.savings_plans
for each row
execute function public.set_updated_at();

alter table public.savings_plans enable row level security;

-- Owner-only. No friend SELECT policy: savings is private (more sensitive than
-- spending). A future "show_savings_*" permission would add a friend policy.
drop policy if exists "savings_plans_select_own" on public.savings_plans;
create policy "savings_plans_select_own"
  on public.savings_plans for select
  using (auth.uid() = user_id);

drop policy if exists "savings_plans_insert_own" on public.savings_plans;
create policy "savings_plans_insert_own"
  on public.savings_plans for insert
  with check (auth.uid() = user_id);

drop policy if exists "savings_plans_update_own" on public.savings_plans;
create policy "savings_plans_update_own"
  on public.savings_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "savings_plans_delete_own" on public.savings_plans;
create policy "savings_plans_delete_own"
  on public.savings_plans for delete
  using (auth.uid() = user_id);
