-- 0009_update_plan_prices.sql
-- Catalog price reconciliation against official vendor pages (2026-05-12).
--
-- Verified each entry in subscription_plans against the vendor's Korean
-- pricing page on 2026-05-12. This migration applies the deltas:
--   A. UPDATE  — KRW-billed services whose prices have drifted since seeding.
--   B. INSERT  — newly launched plans (Wavve ad-tier, Laftel basic).
--   C. DELETE  — discontinued / Korea-unavailable / annual-only plans.
--   D. RENAME  — Laftel's lone "멤버십" relabelled to "프리미엄" now that a
--                cheaper 베이직 tier exists alongside it.
--
-- USD-billed services are converted at a fixed reference rate so the catalog
-- reflects a defensible KRW estimate. Reference rate: 1 USD = 1,470 KRW
-- (snapshot 2026-05-12). Users override the amount on activation if needed.
-- ChatGPT Plus is excluded from the conversion because OpenAI publishes a
-- direct KRW price (₩29,000 VAT-inclusive on chatgpt.com), not a USD peg.
--
-- fixed_expenses.subscription_plan_id is ON DELETE SET NULL, so DELETEs below
-- preserve activated user rows; their plan reference simply becomes a manual
-- item.

set local search_path = public;

-- ============================================================
-- A. UPDATE: price drift on KRW-billed plans
-- ============================================================
update subscription_plans set default_amount = 8690  where service_name = 'Melon'              and plan_name = '스트리밍 클럽';
update subscription_plans set default_amount = 11990 where service_name = 'Spotify'            and plan_name = '프리미엄';
update subscription_plans set default_amount = 8900  where service_name = 'Apple Music'        and plan_name = '개인';
update subscription_plans set default_amount = 9240  where service_name = '지니뮤직'             and plan_name = '무제한';
update subscription_plans set default_amount = 9000  where service_name = '네이버 VIBE'          and plan_name = '무제한 듣기';
update subscription_plans set default_amount = 10450 where service_name = '우주패스'             and plan_name = 'all';
update subscription_plans set default_amount = 16800 where service_name = 'Notion'             and plan_name = 'Plus';
update subscription_plans set default_amount = 12500 where service_name = 'Microsoft 365'      and plan_name = 'Personal';
update subscription_plans set default_amount = 15500 where service_name = 'Microsoft 365'      and plan_name = 'Family';
update subscription_plans set default_amount = 11900 where service_name = '밀리의 서재'           and plan_name is null;
update subscription_plans set default_amount = 12500 where service_name = '윌라'                and plan_name = '오디오북';
update subscription_plans set default_amount = 9900  where service_name = '리디셀렉트'            and plan_name is null;
update subscription_plans set default_amount = 3900  where service_name = '카카오 이모티콘 플러스' and plan_name is null;
update subscription_plans set default_amount = 14000 where service_name = 'iCloud+'            and plan_name = '2TB';
update subscription_plans set default_amount = 8690  where service_name = 'FLO'                and plan_name = '무제한 듣기';

-- USD-billed plans converted at 1 USD = 1,470 KRW (ref. 2026-05-12).
update subscription_plans set default_amount = 29400 where service_name = 'Claude Pro'         and plan_name is null;          -- $20 (renamed below to Claude/Pro)
update subscription_plans set default_amount = 29400 where service_name = 'Cursor'             and plan_name = 'Pro';            -- $20
update subscription_plans set default_amount = 14700 where service_name = 'GitHub Copilot'     and plan_name = '개인';           -- $10
update subscription_plans set default_amount = 12863 where service_name = 'Slack'              and plan_name = 'Pro';            -- $8.75
update subscription_plans set default_amount = 17625 where service_name = 'Dropbox'            and plan_name = 'Plus';           -- $11.99

-- ============================================================
-- B. INSERT: newly launched plans
-- ============================================================
insert into public.subscription_plans (service_name, plan_name, default_amount, category, sort_order)
values
  ('Wavve',         '광고형 스탠다드',        5500,   'OTT',      29),
  ('Laftel',        '베이직',                9900,   'OTT',      59),
  ('FLO',           '모바일 무제한 듣기',     7590,   '음악',     149),
  ('FLO',           '무제한 듣기+오프라인',   11990,  '음악',     151),
  ('배민클럽',       '티빙 번들',             5490,   '배달',     261),
  ('배민클럽',       '유튜브 프리미엄 번들',  15990,  '배달',     262),
  ('ChatGPT',       'Go',                   13000,  'AI',       298),
  ('ChatGPT',       'Pro',                  159000, 'AI',       304),
  ('Claude',        'Max',                  147000, 'AI',       306),  -- $100 @ 1,470 KRW
  ('Google AI',     'Plus',                 11000,  'AI',       310),
  ('Google AI',     'Pro',                  29000,  'AI',       311),
  ('Google AI',     'Ultra',                360000, 'AI',       312),
  ('네이버 MYBOX',  '2TB',                  11000,  '클라우드', 523)
on conflict do nothing;

-- ============================================================
-- C. DELETE: discontinued / Korea-unavailable / annual-only
-- ============================================================
-- YouTube Premium Family is not offered in Korea.
delete from subscription_plans where service_name = 'YouTube Premium' and plan_name = '가족';
-- 신세계 유니버스 클럽: new subscriptions stopped 2026-01-01, service ends 2026-12-31.
delete from subscription_plans where service_name = '신세계 유니버스 클럽';
-- Google One 200GB Standard tier no longer listed on Google's Korean plans page.
delete from subscription_plans where service_name = 'Google One' and plan_name = '200GB';
-- Class101+ ended monthly billing 2023-02-06; annual-only doesn't fit a monthly fixed-expense catalog.
delete from subscription_plans where service_name = 'Class101+';
-- Dropbox Family not listed on dropbox.com Korean plans page — unclear signup path.
delete from subscription_plans where service_name = 'Dropbox' and plan_name = 'Family';

-- ============================================================
-- D. RENAME
-- ============================================================
update subscription_plans set plan_name = '프리미엄' where service_name = 'Laftel' and plan_name = '멤버십';
-- Claude Pro: split service_name/plan_name so Pro and Max share service='Claude'.
update subscription_plans
   set service_name = 'Claude', plan_name = 'Pro'
 where service_name = 'Claude Pro' and plan_name is null;
-- ChatGPT Plus: split so Plus/Go/Pro share service='ChatGPT'.
update subscription_plans
   set service_name = 'ChatGPT', plan_name = 'Plus'
 where service_name = 'ChatGPT Plus' and plan_name is null;
