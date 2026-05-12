-- 0014_recategorize_kakao_emoticon.sql
-- 카카오 이모티콘 플러스는 카카오톡 메신저 부가 서비스 — '독서/교육' 카테고리는
-- 부적절. 다른 부가 멤버십(네이버플러스, 쿠팡 와우 등)과 묶이도록 '멤버십'으로
-- 재분류하고 sort_order도 멤버십 그룹 끝(250)에 배치한다.

set local search_path = public;

update subscription_plans
   set category = '멤버십',
       sort_order = 250
 where service_name = '카카오 이모티콘 플러스';
