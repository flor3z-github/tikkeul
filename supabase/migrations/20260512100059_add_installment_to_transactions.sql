-- Phase 2 of the payment-method / 할부 feature: 신용카드 할부(installment).
--
-- B1 model: one 할부 purchase is materialized as N child transaction rows (one
-- per month) sharing an installment_id. Every existing cycle/grid/friend/
-- realtime/soft-delete path treats them as ordinary rows — no query changes.
--
-- Columns are NULLABLE: ordinary (non-installment) transactions leave all three
-- null. The three move together (all-null or all-set) enforced by a CHECK.

alter table public.transactions
  add column if not exists installment_id uuid,
  add column if not exists installment_seq smallint,
  add column if not exists installment_count smallint;

alter table public.transactions
  drop constraint if exists transactions_installment_consistency_check;
alter table public.transactions
  add constraint transactions_installment_consistency_check
  check (
    (installment_id is null and installment_seq is null and installment_count is null)
    or (
      installment_id is not null
      and installment_seq is not null
      and installment_count is not null
      and installment_count >= 2
      and installment_seq between 1 and installment_count
    )
  );

-- Partial index for grouping/whole-plan delete by installment_id.
create index if not exists transactions_installment_id_idx
  on public.transactions (installment_id)
  where installment_id is not null;

comment on column public.transactions.installment_id is
  '할부 그룹 id. 같은 할부의 N개 회차 행이 공유. null=일반 거래.';
comment on column public.transactions.installment_seq is
  '할부 회차 번호 1..installment_count. null=일반 거래.';
comment on column public.transactions.installment_count is
  '할부 총 개월(회차) 수 >=2. null=일반 거래.';

-- ---------------------------------------------------------------------------
-- create_installment_transactions: atomically insert the N child rows for one
-- 할부. The per-회차 amount/date schedule is computed in JS (lib/utils/
-- installment.ts, tested) and passed in as p_rows jsonb; this function only
-- inserts. Mirrors create_transaction_with_visibility (SECURITY DEFINER, auth +
-- group-ownership checks). 할부 is credit-only, so payment_method is forced to
-- 'credit'. All rows share category/memo/visibility/groups.
--
-- p_rows shape: [{"id": uuid, "amount": numeric, "spent_at": timestamptz,
--                 "seq": int}, ...]  (length must equal p_count)

create or replace function public.create_installment_transactions(
  p_installment_id uuid,
  p_count int,
  p_rows jsonb,
  p_category_id uuid,
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
  v_row jsonb;
  v_row_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if p_visibility not in ('all', 'groups', 'private') then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;
  if p_count < 2 then
    raise exception 'installment count must be >= 2' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) <> p_count then
    raise exception 'installment rows must match count' using errcode = '22023';
  end if;

  -- Validate group ownership once (not per row) so a tampered client can't link
  -- a plan to someone else's group.
  if p_visibility = 'groups' and p_group_ids is not null then
    foreach v_group_id in array p_group_ids loop
      if not exists (
        select 1 from public.friend_groups
        where id = v_group_id and owner_id = v_user
      ) then
        raise exception 'invalid group' using errcode = '22023';
      end if;
    end loop;
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_row_id := (v_row->>'id')::uuid;

    insert into public.transactions
      (id, user_id, amount, category_id, spent_at, memo, visibility,
       payment_method, installment_id, installment_seq, installment_count)
    values
      (v_row_id, v_user, (v_row->>'amount')::numeric, p_category_id,
       (v_row->>'spent_at')::timestamptz, p_memo, p_visibility,
       'credit', p_installment_id, (v_row->>'seq')::int, p_count);

    if p_visibility = 'groups' and p_group_ids is not null then
      foreach v_group_id in array p_group_ids loop
        insert into public.transaction_visibility_groups (transaction_id, group_id)
          values (v_row_id, v_group_id)
          on conflict do nothing;
      end loop;
    end if;
  end loop;
end;
$$;

revoke all on function public.create_installment_transactions(
  uuid, int, jsonb, uuid, text, text, uuid[]
) from public;
grant execute on function public.create_installment_transactions(
  uuid, int, jsonb, uuid, text, text, uuid[]
) to authenticated;
