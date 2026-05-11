-- 0003_seed_categories.sql — shared default categories (user_id IS NULL).
-- Re-runnable: only inserts a category if no shared row with that name exists.

insert into public.categories (user_id, name, color, icon)
select * from (values
  (null::uuid, '식비',  '#FF9500', 'utensils'),
  (null::uuid, '카페',  '#AF52DE', 'coffee'),
  (null::uuid, '교통',  '#5AC8FA', 'bus'),
  (null::uuid, '쇼핑',  '#FF2D55', 'shopping-bag'),
  (null::uuid, '생활',  '#34C759', 'home'),
  (null::uuid, '의료',  '#FF3B30', 'heart-pulse'),
  (null::uuid, '기타',  '#8E8E93', 'more-horizontal')
) as v(user_id, name, color, icon)
where not exists (
  select 1
  from public.categories c
  where c.user_id is null and c.name = v.name
);
