-- 0006_seed_subscription_plans.sql
-- Initial Korean-market subscription catalog.
--
-- ⚠️  Prices below are best-effort estimates and WILL drift. Please review
-- and update before applying. Users can override the amount when adding to
-- their fixed_expenses, so an outdated catalog merely loses the autofill
-- value, not data integrity.
--
-- To update prices in the future, add a new migration (e.g.
-- 20260601000000_update_netflix_plans.sql) with UPDATE statements rather than
-- editing this file.

insert into public.subscription_plans (service_name, plan_name, default_amount, category, sort_order)
select * from (values
  -- OTT
  ('Netflix',      '광고형 스탠다드', 7000,  'OTT', 10),
  ('Netflix',      '베이식(기존 가입자)', 12000, 'OTT', 11),
  ('Netflix',      '스탠다드',      13500,  'OTT', 12),
  ('Netflix',      '프리미엄',      17000,  'OTT', 13),
  ('TVING',        '광고형 스탠다드', 5500, 'OTT', 20),
  ('TVING',        '베이직',         9500, 'OTT', 21),
  ('TVING',        '스탠다드',      13500, 'OTT', 22),
  ('TVING',        '프리미엄',      17000, 'OTT', 23),
  ('Wavve',        '베이식',         7900, 'OTT', 30),
  ('Wavve',        '스탠다드',      10900, 'OTT', 31),
  ('Wavve',        '프리미엄',      13900, 'OTT', 32),
  ('Disney+',      '스탠다드',       9900, 'OTT', 40),
  ('Disney+',      '프리미엄',      13900, 'OTT', 41),
  ('Watcha',       '베이식',         7900, 'OTT', 50),
  ('Watcha',       '프리미엄',      12900, 'OTT', 51),
  ('Laftel',       '멤버십',        14900, 'OTT', 60),
  ('SPOTV NOW',    '베이직',         9900, 'OTT', 70),
  ('SPOTV NOW',    '프리미엄',      19900, 'OTT', 71),

  -- 음악
  ('YouTube Premium', '개인',      14900, '음악', 100),
  ('YouTube Premium', '가족',      23900, '음악', 101),
  ('Melon',        '스트리밍 클럽', 7900, '음악', 110),
  ('Melon',        '무제한 듣기',  11990, '음악', 111),
  ('Spotify',      '프리미엄',    13500, '음악', 120),
  ('Apple Music',  '개인',        10900, '음악', 130),
  ('지니뮤직',     '무제한',       9900, '음악', 140),
  ('FLO',          '무제한 듣기',  7900, '음악', 150),
  ('네이버 VIBE',  '무제한 듣기',  9900, '음악', 160),
  ('Bugs',         '무제한 듣기',  7900, '음악', 170),

  -- 쇼핑/생활 멤버십
  ('쿠팡 와우',     null,          7890, '멤버십', 200),
  ('네이버플러스 멤버십', null,    4900, '멤버십', 210),
  ('신세계 유니버스 클럽', null,   4900, '멤버십', 220),
  ('컬리멤버스',   null,          1900, '멤버십', 230),
  ('우주패스',     'all',         9900, '멤버십', 240),

  -- 배달
  ('배민클럽',     null,          3990, '배달', 260),
  ('요기패스X',    null,          2900, '배달', 270),

  -- AI
  ('ChatGPT Plus', null,        29000, 'AI', 300),
  ('Claude Pro',   null,        29000, 'AI', 301),
  ('Cursor',       'Pro',       27000, 'AI', 302),
  ('GitHub Copilot', '개인',    14000, 'AI', 303),

  -- 생산성
  ('Notion',       'Plus',      14000, '생산성', 350),
  ('Slack',        'Pro',       11250, '생산성', 351),
  ('Microsoft 365', 'Personal', 11900, '생산성', 360),
  ('Microsoft 365', 'Family',  16900, '생산성', 361),

  -- 독서/교육
  ('밀리의 서재',  null,          9900, '독서/교육', 400),
  ('윌라',         '오디오북',    9900, '독서/교육', 410),
  ('리디셀렉트',   null,          4900, '독서/교육', 420),
  ('Class101+',    null,         19000, '독서/교육', 430),
  ('카카오 이모티콘 플러스', null, 6900, '독서/교육', 440),

  -- 클라우드
  ('iCloud+',      '50GB',       1100, '클라우드', 500),
  ('iCloud+',      '200GB',      4400, '클라우드', 501),
  ('iCloud+',      '2TB',       14900, '클라우드', 502),
  ('Google One',   '100GB',      2400, '클라우드', 510),
  ('Google One',   '200GB',      3300, '클라우드', 511),
  ('Google One',   '2TB',       11900, '클라우드', 512),
  ('네이버 MYBOX', '80GB',       1650, '클라우드', 520),
  ('네이버 MYBOX', '180GB',      3300, '클라우드', 521),
  ('네이버 MYBOX', '330GB',      5500, '클라우드', 522),
  ('Dropbox',      'Plus',      14900, '클라우드', 530),
  ('Dropbox',      'Family',    27000, '클라우드', 531)
) as v(service_name, plan_name, default_amount, category, sort_order)
where not exists (
  select 1
  from public.subscription_plans p
  where p.service_name = v.service_name
    and coalesce(p.plan_name, '') = coalesce(v.plan_name, '')
);
