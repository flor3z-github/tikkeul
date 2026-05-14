-- 0027_climate_card_youth_first.sql
-- Move 기후동행카드 30일권(청년할인) to the front of the service group.

set local search_path = public;

update public.subscription_plans set sort_order = 600
  where service_name = '기후동행카드' and plan_name = '30일권(청년할인)';
update public.subscription_plans set sort_order = 601
  where service_name = '기후동행카드' and plan_name = '30일권';
update public.subscription_plans set sort_order = 602
  where service_name = '기후동행카드' and plan_name = '30일권+따릉이';
update public.subscription_plans set sort_order = 603
  where service_name = '기후동행카드' and plan_name = '30일권+한강버스';
update public.subscription_plans set sort_order = 604
  where service_name = '기후동행카드' and plan_name = '30일권+따릉이+한강버스';
