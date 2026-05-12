-- 0005_create_subscription_plans.sql
-- Shared subscription catalog for fixed-expense input convenience.
-- Rows are managed via migrations (no user writes). Visible to all auth users.

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  plan_name text,
  default_amount numeric not null check (default_amount >= 0),
  category text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists subscription_plans_service_name_idx
  on public.subscription_plans (service_name);

create index if not exists subscription_plans_sort_idx
  on public.subscription_plans (sort_order, service_name);

alter table public.subscription_plans enable row level security;

-- Everyone (incl. anon) can read the catalog. Reads are non-sensitive.
-- Tightened to authenticated only since the app requires login anyway.
drop policy if exists "subscription_plans_select_all" on public.subscription_plans;
create policy "subscription_plans_select_all"
  on public.subscription_plans for select
  to authenticated
  using (true);

-- No insert/update/delete policies → blocked for all clients (only service_role
-- via migrations can write).
