-- 0011_add_cursor_tiers.sql
-- Cursor adds Pro+ and Ultra tiers above the existing Pro plan.
-- All billed in USD; converted at the reference rate 1 USD = 1,470 KRW
-- (snapshot 2026-05-12) to stay consistent with the other USD-billed entries.

set local search_path = public;

insert into public.subscription_plans (service_name, plan_name, default_amount, category, sort_order)
values
  ('Cursor', 'Pro+',  88200,  'AI', 308),   -- $60  @ 1,470 KRW
  ('Cursor', 'Ultra', 294000, 'AI', 309)    -- $200 @ 1,470 KRW
on conflict do nothing;
