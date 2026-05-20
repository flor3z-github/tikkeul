-- 0042_friend_groups.sql
-- Per-friend visibility via groups (Instagram "close friends" model,
-- generalized to N groups). Phase 1 ships a single seeded "친한 친구" group
-- per user, but the schema is built for arbitrary user-defined groups so a
-- later phase can layer in group CRUD + a multi-select picker without further
-- schema changes.
--
-- Absorbs the previous transactions.is_private boolean (0038) into the new
-- visibility enum: existing private rows become visibility='private' and the
-- column is dropped.

-- ---------------------------------------------------------------------------
-- 1. friend_groups: owner-defined named groups (seed slug='close')
-- ---------------------------------------------------------------------------
create table if not exists public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create index if not exists friend_groups_owner_idx
  on public.friend_groups (owner_id);

-- Only one row per (owner, slug) for seeded groups. NULL slugs (user-created)
-- are unconstrained because Postgres treats NULLs as distinct.
create unique index if not exists friend_groups_owner_slug_idx
  on public.friend_groups (owner_id, slug)
  where slug is not null;

alter table public.friend_groups enable row level security;

drop policy if exists "friend_groups_select_own" on public.friend_groups;
create policy "friend_groups_select_own"
  on public.friend_groups for select
  using (auth.uid() = owner_id);

drop policy if exists "friend_groups_insert_own" on public.friend_groups;
create policy "friend_groups_insert_own"
  on public.friend_groups for insert
  with check (auth.uid() = owner_id);

drop policy if exists "friend_groups_update_own" on public.friend_groups;
create policy "friend_groups_update_own"
  on public.friend_groups for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Seeded groups (slug not null) cannot be deleted from the client — phase 1
-- has a single "친한 친구" seed and the UI never offers a delete affordance for
-- it. User-created groups (slug null, future phase 2) are freely deletable.
drop policy if exists "friend_groups_delete_own" on public.friend_groups;
create policy "friend_groups_delete_own"
  on public.friend_groups for delete
  using (auth.uid() = owner_id and slug is null);

-- ---------------------------------------------------------------------------
-- 2. friend_group_members: M:N between friend_groups and friend users
-- ---------------------------------------------------------------------------
-- member_user_id must be a friend of the group's owner — enforced by the
-- with_check exists subquery on insert. If the friendship is later removed,
-- the after-delete trigger on friendships (section 8) wipes the member row
-- so the group can't carry a stale reference.
create table if not exists public.friend_group_members (
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, member_user_id)
);

create index if not exists friend_group_members_member_idx
  on public.friend_group_members (member_user_id);

alter table public.friend_group_members enable row level security;

drop policy if exists "friend_group_members_select_own" on public.friend_group_members;
create policy "friend_group_members_select_own"
  on public.friend_group_members for select
  using (
    exists (
      select 1 from public.friend_groups g
      where g.id = friend_group_members.group_id
        and g.owner_id = auth.uid()
    )
  );

drop policy if exists "friend_group_members_insert_own" on public.friend_group_members;
create policy "friend_group_members_insert_own"
  on public.friend_group_members for insert
  with check (
    exists (
      select 1 from public.friend_groups g
      where g.id = friend_group_members.group_id
        and g.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.friendships f
      where f.owner_id = auth.uid()
        and f.viewer_id = friend_group_members.member_user_id
    )
  );

drop policy if exists "friend_group_members_delete_own" on public.friend_group_members;
create policy "friend_group_members_delete_own"
  on public.friend_group_members for delete
  using (
    exists (
      select 1 from public.friend_groups g
      where g.id = friend_group_members.group_id
        and g.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. transaction_visibility_groups: M:N between transactions and groups
-- ---------------------------------------------------------------------------
-- Populated only when transactions.visibility = 'groups'. Inserted in the
-- same DB transaction as the parent tx via the RPCs in section 6 so the
-- realtime broadcast on transactions sees a fully-formed visibility state at
-- event time.
create table if not exists public.transaction_visibility_groups (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  primary key (transaction_id, group_id)
);

create index if not exists transaction_visibility_groups_group_idx
  on public.transaction_visibility_groups (group_id);

alter table public.transaction_visibility_groups enable row level security;

drop policy if exists "tvg_select_own_or_friend"
  on public.transaction_visibility_groups;
create policy "tvg_select_own_or_friend"
  on public.transaction_visibility_groups for select
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_visibility_groups.transaction_id
        and t.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.friend_groups g
      join public.friend_group_members m on m.group_id = g.id
      where g.id = transaction_visibility_groups.group_id
        and m.member_user_id = auth.uid()
    )
  );

drop policy if exists "tvg_insert_own"
  on public.transaction_visibility_groups;
create policy "tvg_insert_own"
  on public.transaction_visibility_groups for insert
  with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_visibility_groups.transaction_id
        and t.user_id = auth.uid()
    )
    and exists (
      select 1 from public.friend_groups g
      where g.id = transaction_visibility_groups.group_id
        and g.owner_id = auth.uid()
    )
  );

drop policy if exists "tvg_delete_own"
  on public.transaction_visibility_groups;
create policy "tvg_delete_own"
  on public.transaction_visibility_groups for delete
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_visibility_groups.transaction_id
        and t.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. transactions.visibility enum + absorb is_private (0038)
-- ---------------------------------------------------------------------------
-- The old SELECT policy from 0038 references is_private, so it must be
-- dropped *before* the column itself is dropped. The new policy is created
-- after the column drop because its USING clause references visibility +
-- transaction_visibility_groups + friend_group_members, all introduced
-- earlier in this migration.
alter table public.transactions
  add column if not exists visibility text not null default 'all'
  check (visibility in ('all', 'groups', 'private'));

update public.transactions
  set visibility = 'private'
  where is_private = true;

drop policy if exists "transactions_select_own_or_friend" on public.transactions;

alter table public.transactions drop column if exists is_private;

-- ---------------------------------------------------------------------------
-- 5. transactions SELECT policy: friend gate now considers visibility + groups
-- ---------------------------------------------------------------------------
create policy "transactions_select_own_or_friend"
  on public.transactions for select
  using (
    auth.uid() = user_id
    or (
      visibility <> 'private'
      and exists (
        select 1 from public.friendships f
        where f.owner_id = public.transactions.user_id
          and f.viewer_id = auth.uid()
          and f.show_spending_items = true
      )
      and (
        visibility = 'all'
        or (
          visibility = 'groups'
          and exists (
            select 1
            from public.transaction_visibility_groups tvg
            join public.friend_group_members m on m.group_id = tvg.group_id
            where tvg.transaction_id = public.transactions.id
              and m.member_user_id = auth.uid()
          )
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 6. RPCs for atomic create/update of (transaction + visibility groups)
-- ---------------------------------------------------------------------------
-- Both run as SECURITY DEFINER so the parent tx INSERT/UPDATE and the
-- corresponding visibility_groups inserts land in one DB transaction. This is
-- what makes realtime correct for visibility='groups' rows: the broadcast on
-- transactions fires after commit, by which time the friend's RLS check on
-- transaction_visibility_groups already sees the matching row.
--
-- Auth is enforced explicitly inside each function because SECURITY DEFINER
-- bypasses RLS on the underlying inserts. The functions also re-validate
-- group ownership so a tampered client can't link a tx to someone else's
-- group.

create or replace function public.create_transaction_with_visibility(
  p_id uuid,
  p_amount numeric,
  p_category_id uuid,
  p_spent_at timestamptz,
  p_memo text,
  p_visibility text,
  p_group_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_group_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if p_visibility not in ('all', 'groups', 'private') then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;

  insert into public.transactions
    (id, user_id, amount, category_id, spent_at, memo, visibility)
  values
    (p_id, v_user, p_amount, p_category_id, p_spent_at, p_memo, p_visibility);

  if p_visibility = 'groups' and p_group_ids is not null then
    foreach v_group_id in array p_group_ids loop
      if not exists (
        select 1 from public.friend_groups
        where id = v_group_id and owner_id = v_user
      ) then
        raise exception 'invalid group' using errcode = '22023';
      end if;
      insert into public.transaction_visibility_groups (transaction_id, group_id)
        values (p_id, v_group_id)
        on conflict do nothing;
    end loop;
  end if;
end;
$$;

revoke all on function public.create_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[]
) from public;
grant execute on function public.create_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[]
) to authenticated;

create or replace function public.update_transaction_with_visibility(
  p_id uuid,
  p_amount numeric,
  p_category_id uuid,
  p_spent_at timestamptz,
  p_memo text,
  p_visibility text,
  p_group_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_group_id uuid;
  v_updated int;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if p_visibility not in ('all', 'groups', 'private') then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;

  update public.transactions
  set amount = p_amount,
      category_id = p_category_id,
      spent_at = p_spent_at,
      memo = p_memo,
      visibility = p_visibility
  where id = p_id and user_id = v_user and deleted_at is null;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'transaction not found' using errcode = '02000';
  end if;

  delete from public.transaction_visibility_groups where transaction_id = p_id;

  if p_visibility = 'groups' and p_group_ids is not null then
    foreach v_group_id in array p_group_ids loop
      if not exists (
        select 1 from public.friend_groups
        where id = v_group_id and owner_id = v_user
      ) then
        raise exception 'invalid group' using errcode = '22023';
      end if;
      insert into public.transaction_visibility_groups (transaction_id, group_id)
        values (p_id, v_group_id)
        on conflict do nothing;
    end loop;
  end if;
end;
$$;

revoke all on function public.update_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[]
) from public;
grant execute on function public.update_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[]
) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. get_friend_spending_total RPC: total respects visibility + groups
-- ---------------------------------------------------------------------------
create or replace function public.get_friend_spending_total(
  target uuid,
  start_iso timestamptz,
  end_iso timestamptz
)
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(t.amount), 0)
  from public.transactions t
  where t.user_id = target
    and t.deleted_at is null
    and t.spent_at >= start_iso
    and t.spent_at <  end_iso
    and t.visibility <> 'private'
    and (
      t.visibility = 'all'
      or (
        t.visibility = 'groups'
        and exists (
          select 1
          from public.transaction_visibility_groups tvg
          join public.friend_group_members m on m.group_id = tvg.group_id
          where tvg.transaction_id = t.id
            and m.member_user_id = auth.uid()
        )
      )
    )
    and exists (
      select 1 from public.friendships f
      where f.owner_id = target
        and f.viewer_id = auth.uid()
        and (f.show_spending_total = true or f.show_spending_items = true)
    );
$$;

revoke all on function public.get_friend_spending_total(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_friend_spending_total(uuid, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. handle_new_user trigger: seed the "친한 친구" group for new users
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
as $$
declare
  provided text;
begin
  provided := nullif(trim(new.raw_user_meta_data->>'display_name'), '');
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(provided, public.random_nickname()))
  on conflict (id) do nothing;

  insert into public.friend_groups (owner_id, name, slug)
  values (new.id, '친한 친구', 'close')
  on conflict do nothing;

  return new;
end;
$$ language plpgsql;

-- Backfill: every existing profile that lacks a 'close' group gets one. The
-- on-conflict guard covers the (impossible-today but constraint-true) case
-- where a user already has a group literally named '친한 친구' with slug=null,
-- which would otherwise violate unique (owner_id, name).
insert into public.friend_groups (owner_id, name, slug)
select p.id, '친한 친구', 'close'
from public.profiles p
where not exists (
  select 1 from public.friend_groups g
  where g.owner_id = p.id and g.slug = 'close'
)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 9. Friendship deletion → drop the ex-friend from every group of the owner
-- ---------------------------------------------------------------------------
-- Friendships are bidirectional (two rows per pairing). The trigger fires per
-- deleted row, using its (owner_id, viewer_id) pair to scrub the membership
-- it implies. The companion row in the other direction is handled by its own
-- trigger firing, so both owners' groups are cleaned regardless of which row
-- gets deleted first.
-- SECURITY DEFINER is required: the unfriend that triggers this can be
-- issued by either side. When user X unfriends, the second deleted row has
-- owner_id=Y, and the membership scrub then targets Y's groups — RLS would
-- block that under the caller's role (auth.uid()=X). Running as the function
-- owner sidesteps RLS so both sides' memberships get cleaned regardless of
-- which row fires the trigger first.
create or replace function public.cleanup_group_membership_on_unfriend()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  delete from public.friend_group_members m
  using public.friend_groups g
  where m.group_id = g.id
    and g.owner_id = old.owner_id
    and m.member_user_id = old.viewer_id;
  return old;
end;
$$;

drop trigger if exists cleanup_group_membership_on_unfriend on public.friendships;
create trigger cleanup_group_membership_on_unfriend
  after delete on public.friendships
  for each row execute function public.cleanup_group_membership_on_unfriend();
