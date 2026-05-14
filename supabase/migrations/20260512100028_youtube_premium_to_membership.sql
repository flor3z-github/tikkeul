-- 0028_youtube_premium_to_membership.sql
-- Move YouTube Premium from 음악 to 멤버십. It functions as a paid account
-- membership (ad-free, background play, YouTube Music bundled in) rather than
-- a pure music streaming plan.

set local search_path = public;

update public.subscription_plans
  set category = '멤버십',
      sort_order = 251
  where service_name = 'YouTube Premium';
