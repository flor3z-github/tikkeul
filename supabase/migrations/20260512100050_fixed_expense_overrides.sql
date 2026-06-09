-- 20260512100050_fixed_expense_overrides.sql
-- Per-cycle amount override for a single recurring fixed_expenses row.
--
-- Some "fixed" expenses vary month to month (bank interest, variable card
-- bills). The base fixed_expenses.amount stays the recurring default; an
-- override row swaps the amount for ONE budget cycle only. The next cycle has
-- no override row, so the effective amount falls back to the base
-- (COALESCE(override.amount, fixed_expenses.amount)). "Revert to base" = delete
-- the row. UNIQUE(fixed_expense_id, cycle_anchor) enforces at most one override
-- per (expense, cycle).
--
-- KEY = cycle_anchor "YYYY-MM" (the anchorYm label month that
-- resolveDashboardParamsB already computes identically for both the owner and a
-- viewing friend). This is pure year-month arithmetic — no Date round-trip, no
-- holiday/business-day dependency — so it is stable under the annual holiday
-- re-seed and free of UTC/KST drift. (A date-range key like income_adjustments'
-- occurred_on would couple membership to the resolved deposit date, which moves
-- when holidays change.)
--
-- Privacy: this table is OWN-ONLY at the RLS layer (no friend-read policy,
-- mirroring income_adjustments). Friends reach the effective amount ONLY through
-- the SECURITY DEFINER RPCs in the next migration, which re-check the
-- show_fixed_items / show_fixed_total perms. The table is NOT added to
-- supabase_realtime.

create table if not exists public.fixed_expense_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fixed_expense_id uuid not null references public.fixed_expenses(id) on delete cascade,
  cycle_anchor text not null check (cycle_anchor ~ '^\d{4}-\d{2}$'),
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixed_expense_id, cycle_anchor)
);

create index if not exists fixed_expense_overrides_user_anchor_idx
  on public.fixed_expense_overrides (user_id, cycle_anchor);

alter table public.fixed_expense_overrides enable row level security;

-- Own-only RLS. No friend-read policy by design: friends never SELECT override
-- rows directly (that would let them enumerate the owner's per-cycle amount
-- history via raw REST). They only ever see the already-coalesced effective
-- number through the perm-gated SECURITY DEFINER RPCs (migration 0051).
create policy "own fixed_expense_overrides read"
  on public.fixed_expense_overrides
  for select
  using (auth.uid() = user_id);

create policy "own fixed_expense_overrides insert"
  on public.fixed_expense_overrides
  for insert
  with check (auth.uid() = user_id);

create policy "own fixed_expense_overrides update"
  on public.fixed_expense_overrides
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own fixed_expense_overrides delete"
  on public.fixed_expense_overrides
  for delete
  using (auth.uid() = user_id);
