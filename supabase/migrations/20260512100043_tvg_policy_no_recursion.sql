-- 0043_tvg_policy_no_recursion.sql
-- Fix infinite recursion between transactions.RLS and
-- transaction_visibility_groups.RLS introduced in 0042.
--
-- Failure mode:
--   SELECT on transactions
--     → policy evaluates `exists (select … from transaction_visibility_groups …)`
--     → triggers tvg SELECT policy
--     → original tvg policy did `exists (select … from transactions …)`
--     → triggers transactions SELECT policy again
--     → ∞ recursion → "infinite recursion detected in policy".
--
-- Fix:
--   1. SELECT policy on tvg no longer queries transactions. Owner is
--      identified via friend_groups.owner_id (a legitimate tvg row's
--      group_id always points to a group the tx owner owns — see RPC).
--   2. INSERT/DELETE policies become hard-deny for direct client traffic.
--      The two SECURITY DEFINER RPCs from 0042
--      (create_transaction_with_visibility, update_transaction_with_visibility)
--      are the only legitimate write paths, and they bypass RLS by design.
--      Hard-deny prevents a malicious viewer from forging visibility links
--      against someone else's transactions (which the cycle-breaking
--      "remove transactions check" approach would have allowed).
--
-- After this migration the eval graph is acyclic:
--   transactions → tvg → (friend_groups, friend_group_members)
-- and tvg policies never reach back into transactions.

drop policy if exists "tvg_select_own_or_friend"
  on public.transaction_visibility_groups;
create policy "tvg_select_own_or_friend"
  on public.transaction_visibility_groups for select
  using (
    exists (
      select 1 from public.friend_groups g
      where g.id = transaction_visibility_groups.group_id
        and g.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.friend_group_members m
      where m.group_id = transaction_visibility_groups.group_id
        and m.member_user_id = auth.uid()
    )
  );

-- INSERT: direct REST inserts are blocked. The SECURITY DEFINER RPCs from
-- 0042 bypass RLS, so the legitimate add/edit-transaction paths continue to
-- work. ON DELETE CASCADE on transaction_id / group_id also bypasses RLS as
-- a system action, so cascade cleanup still functions.
drop policy if exists "tvg_insert_own"
  on public.transaction_visibility_groups;
create policy "tvg_insert_rpc_only"
  on public.transaction_visibility_groups for insert
  with check (false);

drop policy if exists "tvg_delete_own"
  on public.transaction_visibility_groups;
create policy "tvg_delete_rpc_only"
  on public.transaction_visibility_groups for delete
  using (false);

-- ---------------------------------------------------------------------------
-- friend_group_members SELECT: also allow members to read their own row
-- ---------------------------------------------------------------------------
-- The transactions SELECT policy's inner subquery joins tvg + fgm filtering
-- on `m.member_user_id = auth.uid()` — for that join to actually return rows
-- under RLS, the friend (the viewing member) needs to read their own fgm
-- entry. The 0042 policy only allowed the group owner to read, which broke
-- friend visibility of group-restricted transactions.
drop policy if exists "friend_group_members_select_own"
  on public.friend_group_members;
create policy "friend_group_members_select_own_or_self"
  on public.friend_group_members for select
  using (
    member_user_id = auth.uid()
    or exists (
      select 1 from public.friend_groups g
      where g.id = friend_group_members.group_id
        and g.owner_id = auth.uid()
    )
  );
