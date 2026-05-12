-- 0013_add_ms365_premium.sql
-- Microsoft 365 Premium tier (Korean direct KRW pricing, no conversion needed).
-- Sits above Personal/Family in the same service group.
-- Source: microsoft.com/ko-kr 요금제 페이지 (2026-05-12).

set local search_path = public;

insert into public.subscription_plans (service_name, plan_name, default_amount, category, sort_order)
values
  ('Microsoft 365', 'Premium', 29000, '생산성', 362)
on conflict do nothing;
