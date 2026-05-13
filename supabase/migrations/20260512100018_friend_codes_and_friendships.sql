-- 0018_friend_codes_and_friendships.sql
-- Friend code pairing system (auto-mutual). Codes are short-lived single-use
-- pairing tokens; access is granted via friendships rows after redemption.

-- ---------------------------------------------------------------------------
-- friend_codes: short-lived pairing tokens
-- ---------------------------------------------------------------------------
create table if not exists public.friend_codes (
  code text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists friend_codes_owner_active_idx
  on public.friend_codes (owner_id)
  where used_at is null;

-- ---------------------------------------------------------------------------
-- friendships: persistent view permission. owner_id is the data owner;
-- viewer_id is who can see it. auto-mutual creates two rows per pairing.
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);

create index if not exists friendships_viewer_idx on public.friendships (viewer_id);
create index if not exists friendships_owner_idx on public.friendships (owner_id);

-- ---------------------------------------------------------------------------
-- redeem_attempts: rate-limit log for friend code redemption.
-- ---------------------------------------------------------------------------
create table if not exists public.redeem_attempts (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists redeem_attempts_user_time_idx
  on public.redeem_attempts (user_id, attempted_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.friend_codes enable row level security;
alter table public.friendships enable row level security;
alter table public.redeem_attempts enable row level security;

-- friend_codes: owner can read/insert/update their own codes.
-- Redemption flows through a SECURITY DEFINER function (see below) so the
-- viewer never needs SELECT/UPDATE on someone else's code.
drop policy if exists "friend_codes_select_own" on public.friend_codes;
create policy "friend_codes_select_own"
  on public.friend_codes for select
  using (auth.uid() = owner_id);

drop policy if exists "friend_codes_insert_own" on public.friend_codes;
create policy "friend_codes_insert_own"
  on public.friend_codes for insert
  with check (auth.uid() = owner_id);

drop policy if exists "friend_codes_update_own" on public.friend_codes;
create policy "friend_codes_update_own"
  on public.friend_codes for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "friend_codes_delete_own" on public.friend_codes;
create policy "friend_codes_delete_own"
  on public.friend_codes for delete
  using (auth.uid() = owner_id);

-- friendships: either side can read; either side can delete (unpair). Inserts
-- only flow through the redeem function below.
drop policy if exists "friendships_select_either" on public.friendships;
create policy "friendships_select_either"
  on public.friendships for select
  using (auth.uid() = owner_id or auth.uid() = viewer_id);

drop policy if exists "friendships_delete_either" on public.friendships;
create policy "friendships_delete_either"
  on public.friendships for delete
  using (auth.uid() = owner_id or auth.uid() = viewer_id);

-- redeem_attempts: only owner can read/insert their own attempts.
drop policy if exists "redeem_attempts_select_own" on public.redeem_attempts;
create policy "redeem_attempts_select_own"
  on public.redeem_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "redeem_attempts_insert_own" on public.redeem_attempts;
create policy "redeem_attempts_insert_own"
  on public.redeem_attempts for insert
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- redeem_friend_code(code): SECURITY DEFINER atomic redeem + pair.
-- Caller is the redeemer (viewer side). Returns 'ok' on success, otherwise an
-- error code string that the server action translates to a user-facing
-- message. Error codes are intentionally generic for codes that don't exist /
-- are expired / are already used so we don't leak which case applies.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_friend_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_owner uuid;
begin
  v_caller := auth.uid();
  if v_caller is null then
    return 'unauthenticated';
  end if;

  -- Lock the row so two concurrent redemptions can't both succeed.
  select owner_id into v_owner
  from public.friend_codes
  where code = p_code
    and used_at is null
    and expires_at > now()
  for update;

  if v_owner is null then
    return 'invalid';
  end if;

  if v_owner = v_caller then
    return 'self';
  end if;

  -- auto-mutual: both directions.
  insert into public.friendships (owner_id, viewer_id)
  values (v_owner, v_caller), (v_caller, v_owner)
  on conflict (owner_id, viewer_id) do nothing;

  update public.friend_codes
  set used_at = now(),
      used_by = v_caller
  where code = p_code;

  return 'ok';
end;
$$;

revoke all on function public.redeem_friend_code(text) from public;
grant execute on function public.redeem_friend_code(text) to authenticated;
