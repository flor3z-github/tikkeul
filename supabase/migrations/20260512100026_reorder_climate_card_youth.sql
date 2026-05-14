-- 0026_reorder_climate_card_youth.sql
-- Place 기후동행카드 30일권(청년할인) right after the base 30일권 chip.

set local search_path = public;

update public.subscription_plans set sort_order = 601
  where service_name = '기후동행카드' and plan_name = '30일권(청년할인)';
update public.subscription_plans set sort_order = 602
  where service_name = '기후동행카드' and plan_name = '30일권+따릉이';
update public.subscription_plans set sort_order = 603
  where service_name = '기후동행카드' and plan_name = '30일권+한강버스';
update public.subscription_plans set sort_order = 604
  where service_name = '기후동행카드' and plan_name = '30일권+따릉이+한강버스';
