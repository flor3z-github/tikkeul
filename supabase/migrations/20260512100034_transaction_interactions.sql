-- 0034_transaction_interactions.sql
-- Reactions and comments on transactions for the friend-mode dashboard. The
-- transaction owner and any friend who currently has SELECT access to the
-- transaction (= friendships row exists AND show_spending_items = true) may
-- react and comment. Self-reactions/comments are allowed (owner may react on
-- their own row); the notification edge function filters self-events.
--
-- Both tables denormalize `transaction_owner_id` from `transactions.user_id`
-- so client-side realtime filters can use a single equality predicate without
-- a join. A BEFORE INSERT trigger copies the value from `transactions`; the
-- column is NOT NULL so the trigger must fire before the constraint check.

-- ---------------------------------------------------------------------------
-- transaction_reactions
-- Composite PK (transaction_id, user_id, emoji): Slack-style. A user may
-- stack multiple distinct emojis on the same row; toggling the same emoji
-- twice resolves to delete-then-insert at the application layer.
-- ---------------------------------------------------------------------------
create table if not exists public.transaction_reactions (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  transaction_owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (transaction_id, user_id, emoji)
);

create index if not exists transaction_reactions_owner_idx
  on public.transaction_reactions (transaction_owner_id);
create index if not exists transaction_reactions_tx_idx
  on public.transaction_reactions (transaction_id);

-- ---------------------------------------------------------------------------
-- transaction_comments
-- Hard delete only (author or transaction owner). No edit in MVP — the author
-- deletes and reposts. Max 500 chars (vs memo's 100 — comments are
-- conversational).
-- ---------------------------------------------------------------------------
create table if not exists public.transaction_comments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  transaction_owner_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists transaction_comments_tx_created_idx
  on public.transaction_comments (transaction_id, created_at);
create index if not exists transaction_comments_owner_idx
  on public.transaction_comments (transaction_owner_id);

-- ---------------------------------------------------------------------------
-- Trigger: populate transaction_owner_id from transactions.user_id.
-- We unconditionally overwrite whatever the client sent — the column is
-- tamper-proof by construction, so the application never needs to pass it.
-- ---------------------------------------------------------------------------
create or replace function public.set_transaction_owner_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner
  from public.transactions
  where id = new.transaction_id;

  if v_owner is null then
    raise exception 'transaction % not found', new.transaction_id;
  end if;

  new.transaction_owner_id := v_owner;
  return new;
end;
$$;

drop trigger if exists trg_reactions_set_owner on public.transaction_reactions;
create trigger trg_reactions_set_owner
  before insert on public.transaction_reactions
  for each row execute function public.set_transaction_owner_id();

drop trigger if exists trg_comments_set_owner on public.transaction_comments;
create trigger trg_comments_set_owner
  before insert on public.transaction_comments
  for each row execute function public.set_transaction_owner_id();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.transaction_reactions enable row level security;
alter table public.transaction_comments enable row level security;

-- SELECT: owner of the underlying transaction, OR a friend with show_spending_items.
-- We re-check the friendship + items flag so revoking the items flag instantly
-- hides reactions/comments too.
drop policy if exists "transaction_reactions_select" on public.transaction_reactions;
create policy "transaction_reactions_select"
  on public.transaction_reactions for select
  using (
    auth.uid() = transaction_owner_id
    or exists (
      select 1 from public.friendships f
      where f.owner_id = public.transaction_reactions.transaction_owner_id
        and f.viewer_id = auth.uid()
        and f.show_spending_items = true
    )
  );

drop policy if exists "transaction_comments_select" on public.transaction_comments;
create policy "transaction_comments_select"
  on public.transaction_comments for select
  using (
    auth.uid() = transaction_owner_id
    or exists (
      select 1 from public.friendships f
      where f.owner_id = public.transaction_comments.transaction_owner_id
        and f.viewer_id = auth.uid()
        and f.show_spending_items = true
    )
  );

-- INSERT: same predicate as SELECT, AND the row's actor must be the caller.
-- We check against transactions.user_id directly (not the trigger-populated
-- column) because RLS WITH CHECK runs after BEFORE triggers, so the value is
-- present, but for clarity we use the source of truth.
drop policy if exists "transaction_reactions_insert" on public.transaction_reactions;
create policy "transaction_reactions_insert"
  on public.transaction_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.transactions t
      where t.id = public.transaction_reactions.transaction_id
        and t.deleted_at is null
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.friendships f
            where f.owner_id = t.user_id
              and f.viewer_id = auth.uid()
              and f.show_spending_items = true
          )
        )
    )
  );

drop policy if exists "transaction_comments_insert" on public.transaction_comments;
create policy "transaction_comments_insert"
  on public.transaction_comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.transactions t
      where t.id = public.transaction_comments.transaction_id
        and t.deleted_at is null
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.friendships f
            where f.owner_id = t.user_id
              and f.viewer_id = auth.uid()
              and f.show_spending_items = true
          )
        )
    )
  );

-- DELETE: actor or the transaction owner (so the owner can clean up unwanted
-- content on their own row).
drop policy if exists "transaction_reactions_delete" on public.transaction_reactions;
create policy "transaction_reactions_delete"
  on public.transaction_reactions for delete
  using (
    auth.uid() = user_id
    or auth.uid() = transaction_owner_id
  );

drop policy if exists "transaction_comments_delete" on public.transaction_comments;
create policy "transaction_comments_delete"
  on public.transaction_comments for delete
  using (
    auth.uid() = author_id
    or auth.uid() = transaction_owner_id
  );

-- No UPDATE policy: comments are delete-and-repost. Reactions have nothing to
-- update.

-- ---------------------------------------------------------------------------
-- Realtime
-- replica identity full so the client-side filter `transaction_owner_id=eq.X`
-- survives UPDATE/DELETE events. Reactions are INSERT/DELETE-only in practice,
-- but the setting is cheap and future-proof.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transaction_reactions'
  ) then
    alter publication supabase_realtime add table public.transaction_reactions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transaction_comments'
  ) then
    alter publication supabase_realtime add table public.transaction_comments;
  end if;
end $$;

alter table public.transaction_reactions replica identity full;
alter table public.transaction_comments replica identity full;
