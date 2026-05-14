-- 0025_add_transit_plans.sql
-- Add 교통 category to the shared subscription catalog.
-- Plans verified against official sources on 2026-05-14.

set local search_path = public;

insert into public.subscription_plans (service_name, plan_name, default_amount, category, sort_order, aliases)
select * from (values
  ('기후동행카드',       '30일권(청년할인)',      55000, '교통', 600, array['기동카', '기후카드', '청년']::text[]),
  ('기후동행카드',       '30일권',                62000, '교통', 601, array['기동카', '기후카드', '서울교통카드']::text[]),
  ('기후동행카드',       '30일권+따릉이',         65000, '교통', 602, array['기동카', '기후카드']::text[]),
  ('기후동행카드',       '30일권+한강버스',       67000, '교통', 603, array['기동카', '기후카드']::text[]),
  ('기후동행카드',       '30일권+따릉이+한강버스', 70000, '교통', 604, array['기동카', '기후카드']::text[]),
  ('따릉이',             '30일권(1시간)',          5000, '교통', 610, array['서울자전거', 'ttareungi']::text[]),
  ('서울 지하철 정기권', '서울전용',              55000, '교통', 620, array['지하철정기권', '서울정기권', '수도권정기권']::text[]),
  ('카카오T 바이크',     '30일 4회 패스',          5900, '교통', 630, array['카카오바이크', '카카오자전거', 'kakaobike', '카카오티바이크']::text[]),
  ('카카오T 바이크',     '30일 30회 패스',        38900, '교통', 631, array['카카오바이크', '카카오자전거', 'kakaobike', '카카오티바이크']::text[]),
  ('쏘카일레클',         '무제한 패스(1개월)',     7900, '교통', 640, array['일레클', 'elecle', '쏘카바이크', '쏘카자전거']::text[]),
  ('쏘카일레클',         '매일 10분 패스',        25000, '교통', 641, array['일레클', 'elecle', '쏘카바이크', '쏘카자전거']::text[])
) as v(service_name, plan_name, default_amount, category, sort_order, aliases)
where not exists (
  select 1
  from public.subscription_plans p
  where p.service_name = v.service_name
    and coalesce(p.plan_name, '') = coalesce(v.plan_name, '')
);
