-- 0019_friendship_view_policies.sql
-- Extend SELECT policies so a friend (viewer side of a friendships row) can
-- read the other user's transactions and profile. user_settings stays private
-- to its owner; income data is never shared with friends.

-- ---------------------------------------------------------------------------
-- transactions: own rows or rows owned by someone who pairs with me.
-- ---------------------------------------------------------------------------
drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_select_own_or_friend" on public.transactions;
create policy "transactions_select_own_or_friend"
  on public.transactions for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.friendships
      where owner_id = public.transactions.user_id
        and viewer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- profiles: own row or rows of users who pair with me. Required so a friend
-- can see the other's nickname.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_own_or_friend" on public.profiles;
create policy "profiles_select_own_or_friend"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1
      from public.friendships
      where owner_id = public.profiles.id
        and viewer_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE policies are intentionally unchanged: only the owner
-- can mutate their own rows. user_settings policies are unchanged (income is
-- never shared).
