-- 0021_add_aliases_to_subscription_plans.sql
-- Add Korean (and other) aliases so the catalog search box matches
-- "넷플릭스" → "Netflix" etc.
--
-- Aliases are stored as a text[] on subscription_plans. The client folds
-- them into the search haystack alongside service_name / plan_name / category.

set local search_path = public;

alter table public.subscription_plans
  add column if not exists aliases text[] not null default '{}';

-- Seed Korean phonetic aliases for English-named services. Keep aliases short
-- and lowercase-friendly; the client normalizes both sides to lower + no-space.
update public.subscription_plans set aliases = array['넷플릭스']
  where service_name = 'Netflix';
update public.subscription_plans set aliases = array['티빙']
  where service_name = 'TVING';
update public.subscription_plans set aliases = array['웨이브']
  where service_name = 'Wavve';
update public.subscription_plans set aliases = array['디즈니플러스', '디즈니+', '디즈니']
  where service_name = 'Disney+';
update public.subscription_plans set aliases = array['왓챠']
  where service_name = 'Watcha';
update public.subscription_plans set aliases = array['라프텔']
  where service_name = 'Laftel';
update public.subscription_plans set aliases = array['스포티비', '스포티비나우', 'spotv']
  where service_name = 'SPOTV NOW';

update public.subscription_plans set aliases = array['유튜브프리미엄', '유튜브', 'youtube']
  where service_name = 'YouTube Premium';
update public.subscription_plans set aliases = array['멜론']
  where service_name = 'Melon';
update public.subscription_plans set aliases = array['스포티파이']
  where service_name = 'Spotify';
update public.subscription_plans set aliases = array['애플뮤직', 'applemusic']
  where service_name = 'Apple Music';
update public.subscription_plans set aliases = array['플로']
  where service_name = 'FLO';
update public.subscription_plans set aliases = array['벅스']
  where service_name = 'Bugs';

update public.subscription_plans set aliases = array['챗지피티', '챗gpt', 'chatgpt플러스']
  where service_name in ('ChatGPT Plus', 'ChatGPT');
update public.subscription_plans set aliases = array['클로드', '클로드프로']
  where service_name in ('Claude Pro', 'Claude');
update public.subscription_plans set aliases = array['커서']
  where service_name = 'Cursor';
update public.subscription_plans set aliases = array['깃허브코파일럿', '코파일럿', 'copilot']
  where service_name = 'GitHub Copilot';

update public.subscription_plans set aliases = array['노션']
  where service_name = 'Notion';
update public.subscription_plans set aliases = array['슬랙']
  where service_name = 'Slack';
update public.subscription_plans set aliases = array['마이크로소프트365', '엠에스365', 'ms365', 'office365', '오피스365']
  where service_name = 'Microsoft 365';

update public.subscription_plans set aliases = array['클래스101']
  where service_name = 'Class101+';

update public.subscription_plans set aliases = array['아이클라우드']
  where service_name = 'iCloud+';
update public.subscription_plans set aliases = array['구글원', '구글드라이브']
  where service_name = 'Google One';
update public.subscription_plans set aliases = array['드롭박스']
  where service_name = 'Dropbox';

-- Reverse direction: Korean-named services typed in English (romanization /
-- brand-English / common English keyword users associate with the service).
update public.subscription_plans set aliases = array['coupang', 'wow', 'coupangwow', 'rocket']
  where service_name = '쿠팡 와우';
update public.subscription_plans set aliases = array['naver', 'naverplus', 'naverplusmembership']
  where service_name = '네이버플러스 멤버십';
update public.subscription_plans set aliases = array['baemin', 'baeminclub', 'woowa', '배달의민족']
  where service_name = '배민클럽';
update public.subscription_plans set aliases = array['yogiyo', 'yogipassx', 'yogipass']
  where service_name = '요기패스X';
update public.subscription_plans set aliases = array['genie', 'geniemusic']
  where service_name = '지니뮤직';
update public.subscription_plans set aliases = array['naver', 'vibe', 'navervibe']
  where service_name = '네이버 VIBE';
update public.subscription_plans set aliases = array['naver', 'mybox', 'navermybox', 'naverdrive']
  where service_name = '네이버 MYBOX';
update public.subscription_plans set aliases = array['millie', 'milly', 'milliebooks']
  where service_name = '밀리의 서재';
update public.subscription_plans set aliases = array['willa', 'welaaa']
  where service_name = '윌라';
update public.subscription_plans set aliases = array['ridi', 'ridiselect', 'ridibooks']
  where service_name = '리디셀렉트';
update public.subscription_plans set aliases = array['kakao', 'emoticon', 'kakaoemoticon']
  where service_name = '카카오 이모티콘 플러스';
update public.subscription_plans set aliases = array['kurly', 'marketkurly', 'kurlymembers']
  where service_name = '컬리멤버스';
update public.subscription_plans set aliases = array['shinsegae', 'ssg', 'ssguniverse', 'shinsegaeuniverse']
  where service_name = '신세계 유니버스 클럽';
update public.subscription_plans set aliases = array['skt', 'sktelecom', 'uzupass', 'uzu', 'sktpass']
  where service_name = '우주패스';
