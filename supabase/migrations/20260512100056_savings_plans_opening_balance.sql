-- 20260512100056_savings_plans_opening_balance.sql
-- Opening balance for savings already in progress before the user records them.
--
-- "모은 돈" is derived (월적립 × 적립 횟수 since start_date). That breaks for a
-- plan the user has been contributing to for a long time: they may not know the
-- real start, and a lump is already accumulated. opening_balance captures the
-- amount already saved as of start_date, so the user can set start_date = today,
-- enter what they currently have, and let it grow forward.
--
--   accrued(now) = opening_balance + monthly × deposits(start_date → now)
--
-- It is a STOCK (pre-existing), so it counts toward "현재 모은 돈" and goal
-- progress but NOT toward the "이번 달 / 올해 모은 돈" cash-flow totals.

alter table public.savings_plans
  add column if not exists opening_balance numeric not null default 0
  check (opening_balance >= 0);
