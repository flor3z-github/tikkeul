-- 0039_recategorize_categories.sql
-- Subdivide shared spending categories from 7 to 12 (incl. 기타 fallback).
-- Strategy:
--   - Rename 4 existing categories and update their icons where they change.
--   - Insert 5 new categories.
--   - Keep 식비 / 쇼핑 / 기타 untouched.
-- Existing transactions keep their category_id (FK preserved) — they will
-- automatically render under the renamed category name.

-- Renames + icon refresh ----------------------------------------------------
update public.categories
   set name = '카페/간식',
       icon = 'coffee'
 where user_id is null and name = '카페';

update public.categories
   set name = '교통/자동차',
       icon = 'car'
 where user_id is null and name = '교통';

update public.categories
   set name = '주거/통신',
       icon = 'home'
 where user_id is null and name = '생활';

update public.categories
   set name = '의료/건강',
       icon = 'heart-pulse'
 where user_id is null and name = '의료';

-- New shared categories -----------------------------------------------------
insert into public.categories (user_id, name, color, icon)
select * from (values
  (null::uuid, '술/유흥',    '#A2845E', 'wine'),
  (null::uuid, '문화/여가',  '#5856D6', 'film'),
  (null::uuid, '여행/숙박',  '#30B0C7', 'plane'),
  (null::uuid, '경조/선물',  '#FF6482', 'gift'),
  (null::uuid, '데이트',     '#FF375F', 'heart-handshake')
) as v(user_id, name, color, icon)
where not exists (
  select 1
  from public.categories c
  where c.user_id is null and c.name = v.name
);
