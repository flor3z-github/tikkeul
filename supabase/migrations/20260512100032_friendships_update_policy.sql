-- 0032_friendships_update_policy.sql
-- Add UPDATE policy on friendships so the owner of a row can edit the
-- visibility flags introduced in 0031. Without this, an authenticated
-- client UPDATE is silently filtered out by RLS (0 rows affected, no
-- error), making the per-friend visibility toggles appear to work but
-- never persist. INSERT remains routed through the SECURITY DEFINER
-- redeem_friend_code RPC; DELETE remains "either side" per 0018.

drop policy if exists "friendships_update_owner" on public.friendships;
create policy "friendships_update_owner"
  on public.friendships for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
