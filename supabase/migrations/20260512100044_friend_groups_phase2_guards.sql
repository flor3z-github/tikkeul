-- 0044_friend_groups_phase2_guards.sql
-- Phase 2 prep: guard rails on friend_groups before the multi-group UI ships.
--
-- 1. slug immutability — the seed group is identified by slug='close'. Without
--    this guard a user could clear the slug on the seed (making it look like
--    a custom group), and then delete it via the 0042 delete policy
--    (`using (auth.uid() = owner_id and slug is null)`). Conversely, a user
--    could promote a custom group to slug='close' and end up with two seeds.
--    Make slug immutable for everyone — there is no legitimate reason for
--    user-driven slug changes.
--
-- 2. per-owner group count cap (10) — product decision. Triggers at INSERT
--    time, counts only the owner's existing rows so seed creation in
--    handle_new_user (0 → 1) is unaffected.
--
-- 3. delete-cascade to transaction visibility — when a group is deleted, the
--    transaction_visibility_groups rows pointing at it are removed by
--    ON DELETE CASCADE. Any transaction that was visibility='groups' and is
--    now left without any tvg link would otherwise become silently visible
--    to all friends (because the policy treats `groups` with no rows as
--    no-match → falls through to the all-friends branch). Flip those orphans
--    to 'private' so deleting a group never accidentally widens visibility.

-- ---------------------------------------------------------------------------
-- 1. slug immutability
-- ---------------------------------------------------------------------------
create or replace function public.guard_friend_group_slug_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.slug is distinct from new.slug then
    raise exception 'friend_groups.slug is immutable (was %, attempted %)',
      old.slug, new.slug
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists friend_groups_guard_slug on public.friend_groups;
create trigger friend_groups_guard_slug
  before update on public.friend_groups
  for each row execute function public.guard_friend_group_slug_immutable();

-- ---------------------------------------------------------------------------
-- 2. per-owner group cap
-- ---------------------------------------------------------------------------
create or replace function public.enforce_friend_group_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt int;
begin
  select count(*) into cnt
    from public.friend_groups
    where owner_id = new.owner_id;
  if cnt >= 10 then
    raise exception 'friend group limit reached for owner % (max 10)', new.owner_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists friend_groups_enforce_limit on public.friend_groups;
create trigger friend_groups_enforce_limit
  before insert on public.friend_groups
  for each row execute function public.enforce_friend_group_limit();

-- ---------------------------------------------------------------------------
-- 3. cascade group delete → private visibility for orphaned transactions
-- ---------------------------------------------------------------------------
-- AFTER DELETE: by this point the FK cascade has already removed the
-- transaction_visibility_groups rows that pointed at OLD.id, so the EXISTS
-- subquery below correctly reports whether the transaction has any other
-- group link remaining.
--
-- SECURITY DEFINER is needed because:
--   - this runs synchronously inside auth.users → friend_groups cascade, in
--     which case current_user is not the transaction owner;
--   - explicit user-initiated DELETE comes from `authenticated`, and the
--     transactions UPDATE policy would otherwise constrain the WHERE.
-- Scope is fenced to t.user_id = old.owner_id so we only ever touch the
-- group owner's transactions.
create or replace function public.cascade_group_delete_to_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.transactions t
    set visibility = 'private'
    where t.user_id = old.owner_id
      and t.visibility = 'groups'
      and not exists (
        select 1 from public.transaction_visibility_groups tvg
        where tvg.transaction_id = t.id
      );
  return old;
end;
$$;

drop trigger if exists friend_groups_cascade_visibility on public.friend_groups;
create trigger friend_groups_cascade_visibility
  after delete on public.friend_groups
  for each row execute function public.cascade_group_delete_to_visibility();
