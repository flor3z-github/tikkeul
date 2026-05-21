-- Per-cycle one-shot income (bonus, refund, side income) that supplements
-- the recurring monthly_income stored on user_settings. The dashboard sums
-- adjustments whose `occurred_on` falls inside the current budget cycle and
-- adds them to the effective income used by spendingRate / remainingBudget.
--
-- Privacy: this table inherits the same stance as user_settings.monthly_income
-- — never exposed to friends. RLS grants access only to the owning user;
-- there is no friend-read policy and the table is not added to
-- supabase_realtime.

create table if not exists public.income_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_on date not null,
  amount numeric not null check (amount > 0),
  memo text check (char_length(memo) <= 100),
  created_at timestamptz not null default now()
);

create index if not exists income_adjustments_user_date_idx
  on public.income_adjustments (user_id, occurred_on desc);

alter table public.income_adjustments enable row level security;

create policy "own income_adjustments read"
  on public.income_adjustments
  for select
  using (auth.uid() = user_id);

create policy "own income_adjustments insert"
  on public.income_adjustments
  for insert
  with check (auth.uid() = user_id);

create policy "own income_adjustments update"
  on public.income_adjustments
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own income_adjustments delete"
  on public.income_adjustments
  for delete
  using (auth.uid() = user_id);
