-- N명 나눠내기 상한을 4 → 10으로 확장. 폼이 칩(2~4)에서 native select(안 나눔 + 2~10)로
-- 바뀌면서 상한을 올린다. widening이라 기존 행/구 8-arg 클라이언트 하위호환(2..4 ⊂ 2..10).
-- RPC 시그니처는 불변 — guard 본문의 `between 2 and 4`만 `between 2 and 10`으로 바꾸므로
-- `create or replace`로 본문만 교체한다(drop 불필요, 기존 grant 보존). 단일 소스
-- lib/utils/split.ts SPLIT_MAX_PEOPLE도 10으로 맞춘다. consistency(둘 다 null 또는 둘 다
-- set, 총액>0)는 그대로 유지.

alter table public.transactions
  drop constraint if exists transactions_split_consistency_check;
alter table public.transactions
  add constraint transactions_split_consistency_check
  check (
    (split_count is null and split_total is null)
    or (
      split_count is not null
      and split_total is not null
      and split_count between 2 and 10
      and split_total > 0
    )
  );

comment on column public.transactions.split_count is
  'N명 나눠내기 인원(2..10). null=안 나눔. amount=내 몫(round(split_total/N)).';

-- ---------------------------------------------------------------------------
-- 두 RPC의 split guard를 2..10으로. 본문은 0060과 동일, 숫자만 변경. 시그니처 불변이라
-- drop 없이 create or replace. SECURITY DEFINER + auth.uid()/group-ownership 보존.

create or replace function public.create_transaction_with_visibility(
  p_id uuid,
  p_amount numeric,
  p_category_id uuid,
  p_spent_at timestamptz,
  p_memo text,
  p_visibility text,
  p_group_ids uuid[],
  p_payment_method text default null,
  p_split_count int default null,
  p_split_total numeric default null
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
  -- split은 둘 다 null(안 나눔) 또는 둘 다 set(2..10, 총액>0).
  if not (
    (p_split_count is null and p_split_total is null)
    or (p_split_count between 2 and 10 and p_split_total is not null and p_split_total > 0)
  ) then
    raise exception 'invalid split' using errcode = '22023';
  end if;

  insert into public.transactions
    (id, user_id, amount, category_id, spent_at, memo, visibility,
     payment_method, split_count, split_total)
  values
    (p_id, v_user, p_amount, p_category_id, p_spent_at, p_memo, p_visibility,
     p_payment_method, p_split_count, p_split_total);

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

grant execute on function public.create_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[], text, int, numeric
) to authenticated;

create or replace function public.update_transaction_with_visibility(
  p_id uuid,
  p_amount numeric,
  p_category_id uuid,
  p_spent_at timestamptz,
  p_memo text,
  p_visibility text,
  p_group_ids uuid[],
  p_payment_method text default null,
  p_split_count int default null,
  p_split_total numeric default null
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
  if not (
    (p_split_count is null and p_split_total is null)
    or (p_split_count between 2 and 10 and p_split_total is not null and p_split_total > 0)
  ) then
    raise exception 'invalid split' using errcode = '22023';
  end if;

  update public.transactions
  set amount = p_amount,
      category_id = p_category_id,
      spent_at = p_spent_at,
      memo = p_memo,
      visibility = p_visibility,
      payment_method = coalesce(p_payment_method, payment_method),
      split_count = p_split_count,
      split_total = p_split_total
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

grant execute on function public.update_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[], text, int, numeric
) to authenticated;
