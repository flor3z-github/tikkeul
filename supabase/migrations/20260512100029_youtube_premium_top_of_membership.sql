-- 0029_youtube_premium_top_of_membership.sql
-- Pin YouTube Premium to the top of the 멤버십 group.

set local search_path = public;

update public.subscription_plans
  set sort_order = 195
  where service_name = 'YouTube Premium';
