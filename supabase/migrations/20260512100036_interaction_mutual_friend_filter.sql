-- 0036_interaction_mutual_friend_filter.sql
-- Tighten SELECT policies on transaction_reactions / transaction_comments so a
-- viewer only sees a reaction/comment when they are *also* friends with the
-- actor (reactor / author). Previously, every friend of the transaction owner
-- could see every reaction/comment regardless of whether they knew the actor —
-- which leaked an actor's identity to the owner's other friends ("friend of a
-- friend"). Now the rule is "mutual friend": viewer must be paired with both
-- the transaction owner and the actor to see the row.
--
-- Owner of the transaction continues to see everything (own row), and the
-- actor continues to see their own reaction/comment. INSERT/DELETE policies
-- are unchanged: at insert time the actor is the caller, so the mutual-friend
-- check is trivially satisfied; delete is still actor-or-owner.
--
-- Counts shown in the UI are derived from the rows the viewer can SELECT, so
-- this policy change makes counts viewer-specific too — by design.

drop policy if exists "transaction_reactions_select" on public.transaction_reactions;
create policy "transaction_reactions_select"
  on public.transaction_reactions for select
  using (
    auth.uid() = transaction_owner_id
    or auth.uid() = user_id
    or (
      exists (
        select 1 from public.friendships f
        where f.owner_id = public.transaction_reactions.transaction_owner_id
          and f.viewer_id = auth.uid()
          and f.show_spending_items = true
      )
      and exists (
        select 1 from public.friendships f
        where f.owner_id = public.transaction_reactions.user_id
          and f.viewer_id = auth.uid()
      )
    )
  );

drop policy if exists "transaction_comments_select" on public.transaction_comments;
create policy "transaction_comments_select"
  on public.transaction_comments for select
  using (
    auth.uid() = transaction_owner_id
    or auth.uid() = author_id
    or (
      exists (
        select 1 from public.friendships f
        where f.owner_id = public.transaction_comments.transaction_owner_id
          and f.viewer_id = auth.uid()
          and f.show_spending_items = true
      )
      and exists (
        select 1 from public.friendships f
        where f.owner_id = public.transaction_comments.author_id
          and f.viewer_id = auth.uid()
      )
    )
  );
