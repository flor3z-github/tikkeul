-- 0004_remove_subscription_category.sql
-- '구독' is treated as a fixed expense, not a variable spending category.
-- Drop the shared seed row. Existing transactions referencing it will have
-- their `category_id` set to NULL via the FK ON DELETE SET NULL rule.
-- (They will render as "기타" in the UI.)

delete from public.categories
where user_id is null and name = '구독';
