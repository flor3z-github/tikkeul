-- 0012_add_copilot_tiers.sql
-- GitHub Copilot has been restructured into Pro / Pro+ / Business / Enterprise.
-- This migration:
--   1. Renames the existing "개인" plan to "Pro" to match GitHub's current label.
--   2. Adds the new Pro+ tier ($39/mo).
-- USD prices converted at 1 USD = 1,470 KRW (snapshot 2026-05-12).

set local search_path = public;

-- Rename legacy "개인" → "Pro" so the catalog matches GitHub's official labels.
update subscription_plans
   set plan_name = 'Pro'
 where service_name = 'GitHub Copilot' and plan_name = '개인';

insert into public.subscription_plans (service_name, plan_name, default_amount, category, sort_order)
values
  ('GitHub Copilot', 'Pro+', 57330, 'AI', 313)   -- $39 @ 1,470 KRW
on conflict do nothing;
