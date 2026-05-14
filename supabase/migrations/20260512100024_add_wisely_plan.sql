-- 0024_add_wisely_plan.sql
-- Add 와이즐리 멤버십 to the shared subscription catalog.

set local search_path = public;

insert into public.subscription_plans (service_name, plan_name, default_amount, category, sort_order, aliases)
select * from (values
  ('와이즐리', '멤버십', 2990, '멤버십', 250, array['wisely']::text[])
) as v(service_name, plan_name, default_amount, category, sort_order, aliases)
where not exists (
  select 1
  from public.subscription_plans p
  where p.service_name = v.service_name
    and coalesce(p.plan_name, '') = coalesce(v.plan_name, '')
);
