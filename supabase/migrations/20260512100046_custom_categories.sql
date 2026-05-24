-- 0046_custom_categories.sql
-- Opens up per-user custom spending categories (create/update/delete). The
-- categories table already supported per-user rows (user_id = <uid>) via the
-- 0002 RLS policies; this migration adds the guards + the two RPCs the UI and
-- friend-mode backfill need.
--
-- Guards:
--   - UNIQUE(user_id, name): a user can't create two customs with the same
--     name. NULL user_id seeds are unaffected (Postgres treats NULLs as
--     distinct), so seeds with the same name across the NULL space never
--     collide here.
--   - name length 1..10: the longest current seed name (교통/자동차) is 6 chars,
--     so this bound safely covers every seed while giving customs headroom.
--
-- RPCs:
--   - delete_category: reassigns the user's transactions off the deleted
--     category onto the shared 기타 seed (FK is ON DELETE SET NULL, so a plain
--     delete would orphan them to null — we want 기타, not 미분류), then deletes
--     the category. SECURITY DEFINER + explicit auth/ownership checks.
--   - get_user_categories: exposes a target user's CUSTOM category metadata
--     (id/name/icon/color) to the caller when the caller is the target or an
--     accepted friend (viewer side of a friendships row owned by target).
--     Seeds are already readable by everyone via RLS, so only customs need
--     this. Used by friend-mode to render the owner's custom labels/icons/
--     colors that friend RLS would otherwise hide.

-- ---------------------------------------------------------------------------
-- 1. Guards on categories
-- ---------------------------------------------------------------------------
create unique index if not exists categories_user_name_uniq
  on public.categories (user_id, name);

alter table public.categories
  drop constraint if exists categories_name_len;
alter table public.categories
  add constraint categories_name_len
  check (char_length(name) between 1 and 10);

-- ---------------------------------------------------------------------------
-- 2. delete_category RPC: reassign to 기타, then delete (atomic)
-- ---------------------------------------------------------------------------
create or replace function public.delete_category(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_owns boolean;
  v_misc_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  -- Must be the caller's own custom category. Seed rows (user_id is null)
  -- and other users' customs are rejected — seeds are not deletable.
  select exists (
    select 1 from public.categories
    where id = p_id and user_id = v_user
  ) into v_owns;
  if not v_owns then
    raise exception 'category not found' using errcode = '02000';
  end if;

  -- Resolve the shared 기타 seed id at runtime (never hardcoded).
  select id into v_misc_id
  from public.categories
  where user_id is null and name = '기타'
  limit 1;
  if v_misc_id is null then
    raise exception 'fallback category missing' using errcode = 'P0002';
  end if;

  -- Reassign the caller's transactions off the deleted category to 기타.
  update public.transactions
  set category_id = v_misc_id
  where category_id = p_id and user_id = v_user;

  delete from public.categories
  where id = p_id and user_id = v_user;
end;
$$;

revoke all on function public.delete_category(uuid) from public;
grant execute on function public.delete_category(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_user_categories RPC: expose a target's custom category metadata
-- ---------------------------------------------------------------------------
create or replace function public.get_user_categories(target uuid)
returns table(id uuid, name text, icon text, color text)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name, c.icon, c.color
  from public.categories c
  where c.user_id = target
    and (
      target = auth.uid()
      or exists (
        select 1 from public.friendships f
        where f.owner_id = target and f.viewer_id = auth.uid()
      )
    );
$$;

revoke all on function public.get_user_categories(uuid) from public;
grant execute on function public.get_user_categories(uuid) to authenticated;
