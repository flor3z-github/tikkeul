-- 0010_add_20x_ai_plans.sql
-- Add 20x usage tiers for ChatGPT Pro and Claude Max alongside the existing
-- 5x defaults. The 5x rows seeded in 0006/0009 (ChatGPT/Pro, Claude/Max)
-- represent the lower usage tier; these new rows capture the higher tier.
--
-- ChatGPT Pro 20x: ₩299,000 (direct KRW price published on chatgpt.com).
-- Claude Max 20x:  $200 @ 1,470 KRW = ₩294,000 (Anthropic bills in USD).

set local search_path = public;

insert into public.subscription_plans (service_name, plan_name, default_amount, category, sort_order)
values
  ('ChatGPT', 'Pro 20x', 299000, 'AI', 305),
  ('Claude',  'Max 20x', 294000, 'AI', 307)  -- $200 @ 1,470 KRW
on conflict do nothing;
