-- N명 나눠내기(정산): 소비 1건을 여러 명이 나눠 냈을 때 "내 몫"만 소비로 기록하고
-- (amount = round(total/N)), 표시용으로 원래 총액(split_total)과 인원(split_count)을
-- 남긴다. amount는 항상 내 몫이라 예산·주기·그리드·친구·/stats 등 기존 쿼리는 이 행을
-- 일반 거래로 그대로 취급한다(할부 B1과 같은 철학 — 쿼리 무변경). 계산 로직은 tested
-- lib/utils/split.ts::computeShare.
--
-- 두 컬럼은 NULLABLE: 일반(안 나눈) 거래는 둘 다 null. 둘은 함께 움직인다(둘 다 null
-- 또는 둘 다 set) — 할부 consistency CHECK와 같은 형태. split_count는 2..4(폼 칩과
-- 동일; 단일 소스 lib/utils/split.ts SPLIT_MAX_PEOPLE).
--
-- 배포 순서 M -> code: 새 p_split_count/p_split_total 파라미터에 DEFAULT null을 줘
-- 배포 창 동안 OLD 8-arg 클라이언트가 재생성된 함수에 그대로 resolve되게 한다. 기존
-- 8-arg overload는 반드시 먼저 drop — 안 그러면 8-arg 호출이 dropped 시그니처와
-- default-param 시그니처 사이에서 ambiguous가 된다(0058 payment_method와 동일).

alter table public.transactions
  add column if not exists split_count smallint,
  add column if not exists split_total numeric;

alter table public.transactions
  drop constraint if exists transactions_split_consistency_check;
alter table public.transactions
  add constraint transactions_split_consistency_check
  check (
    (split_count is null and split_total is null)
    or (
      split_count is not null
      and split_total is not null
      and split_count between 2 and 4
      and split_total > 0
    )
  );

comment on column public.transactions.split_count is
  'N명 나눠내기 인원(2..4). null=안 나눔. amount=내 몫(round(split_total/N)).';
comment on column public.transactions.split_total is
  'N명 나눠내기 총액(> 0, 표시용). null=안 나눔. amount는 내 몫만 저장.';

-- ---------------------------------------------------------------------------
-- create/update RPC를 p_split_count/p_split_total 파라미터를 붙여 재생성. 본문은
-- 0058(payment_method)에서 그대로 가져오고 INSERT 컬럼/UPDATE set에 split 두 컬럼을
-- 추가. SECURITY DEFINER + auth.uid()/group-ownership 검사는 그대로 보존.
--
-- UPDATE는 payment_method처럼 coalesce하지 '않고' 그대로 set한다: split_count=null은
-- "안 나눔"이라는 정당한 새-클라이언트 값이라(편집에서 분할 해제 가능해야 함) coalesce로
-- 보존하면 해제가 막힌다. 대신 배포 후 오래된 PWA(Serwist precache)가 8-arg update를
-- 쏘면 실 분할 행의 표시 메타(총액/인원)가 지워질 수 있으나 — amount(내 몫·예산)는
-- 무관하고 뱃지만 사라지는 표시상 degradation이라 감수한다(드묾·비파괴).

drop function if exists public.create_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[], text
);

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
  -- split은 둘 다 null(안 나눔) 또는 둘 다 set(2..4, 총액>0). CHECK와 동일하지만
  -- 친절한 에러코드로 먼저 거른다.
  if not (
    (p_split_count is null and p_split_total is null)
    or (p_split_count between 2 and 4 and p_split_total is not null and p_split_total > 0)
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

revoke all on function public.create_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[], text, int, numeric
) from public;
grant execute on function public.create_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[], text, int, numeric
) to authenticated;

drop function if exists public.update_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[], text
);

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
    or (p_split_count between 2 and 4 and p_split_total is not null and p_split_total > 0)
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
      -- coalesce하지 않음(위 주석 참고): null = 분할 해제라는 정당한 값.
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

revoke all on function public.update_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[], text, int, numeric
) from public;
grant execute on function public.update_transaction_with_visibility(
  uuid, numeric, uuid, timestamptz, text, text, uuid[], text, int, numeric
) to authenticated;
