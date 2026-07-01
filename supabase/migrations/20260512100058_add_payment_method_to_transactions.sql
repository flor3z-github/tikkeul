-- Phase 1 of the payment-method / 할부 feature: add a 신용/체크 결제수단 column
-- to transactions and thread it through the create/update RPCs.
--
-- Column is NULLABLE: rows created before this migration stay null and surface
-- as "미지정" in /stats. Every NEW transaction sets a method (the form requires
-- one), so the credit/debit ratio is meaningful from here on. The CHECK allows
-- null OR one of the two enum values; app-side validation is the first gate.
--
-- Deployment order is M -> code: the new p_payment_method param has DEFAULT null
-- so an OLD 7-arg client keeps resolving to the SAME recreated function. The old
-- 7-arg overloads MUST be dropped first, else a 7-arg call is ambiguous between
-- the dropped signature and the default-param one.
--
-- The UPDATE uses coalesce(p_payment_method, payment_method): a stale pre-Phase1
-- PWA (Serwist precache can outlive a code deploy by weeks) still issues 7-arg
-- updates -> p_payment_method = null -> a bare `set payment_method = null` would
-- WIPE a real value on an unrelated edit (e.g. an amount fix). The new client
-- always sends a non-null method (validated), so null at the RPC is never a
-- legitimate "clear it" intent — coalesce preserves the stored value for old
-- clients while new clients overwrite as normal.
--
-- create OR REPLACE (not a bare create) so a manual SQL-editor re-apply stays
-- idempotent — every other function migration in this repo uses or-replace.

alter table public.transactions
  add column if not exists payment_method text
  check (payment_method is null or payment_method in ('credit', 'debit'));

comment on column public.transactions.payment_method is
  '결제수단: credit=신용카드, debit=체크카드, null=미지정(legacy). app-validated.';

-- ---------------------------------------------------------------------------
-- Recreate create/update RPCs with the extra p_payment_method param. Bodies are
-- copied verbatim from 20260512100042_friend_groups.sql, with payment_method
-- added to the INSERT column list / UPDATE set. SECURITY DEFINER + the explicit
-- auth.uid() / group-ownership checks are preserved exactly.

drop function if exists public.create_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[]
);

create or replace function public.create_transaction_with_visibility(
  p_id uuid,
  p_amount numeric,
  p_category_id uuid,
  p_spent_at timestamptz,
  p_memo text,
  p_visibility text,
  p_group_ids uuid[],
  p_payment_method text default null
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
  if p_payment_method is not null
     and p_payment_method not in ('credit', 'debit') then
    raise exception 'invalid payment method' using errcode = '22023';
  end if;

  insert into public.transactions
    (id, user_id, amount, category_id, spent_at, memo, visibility, payment_method)
  values
    (p_id, v_user, p_amount, p_category_id, p_spent_at, p_memo, p_visibility, p_payment_method);

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
  uuid, numeric, uuid, timestamptz, text, text, uuid[], text
) from public;
grant execute on function public.create_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[], text
) to authenticated;

drop function if exists public.update_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[]
);

create or replace function public.update_transaction_with_visibility(
  p_id uuid,
  p_amount numeric,
  p_category_id uuid,
  p_spent_at timestamptz,
  p_memo text,
  p_visibility text,
  p_group_ids uuid[],
  p_payment_method text default null
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
  if p_payment_method is not null
     and p_payment_method not in ('credit', 'debit') then
    raise exception 'invalid payment method' using errcode = '22023';
  end if;

  update public.transactions
  set amount = p_amount,
      category_id = p_category_id,
      spent_at = p_spent_at,
      memo = p_memo,
      visibility = p_visibility,
      payment_method = coalesce(p_payment_method, payment_method)
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
  uuid, numeric, uuid, timestamptz, text, text, uuid[], text
) from public;
grant execute on function public.update_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[], text
) to authenticated;
