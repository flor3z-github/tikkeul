"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { TransactionVisibility } from "@/lib/queries/transactions";
import {
  CATEGORY_COLORS,
  CATEGORY_ICON_SLUGS,
} from "@/lib/utils/category-icon";
import { nowInSeoul } from "@/lib/utils/date";
import { isValidPaymentDay } from "@/lib/utils/payment-day";
import { isPaymentMethod, type PaymentMethod } from "@/lib/utils/payment-method";
import { installmentSchedule } from "@/lib/utils/installment";
import { isValidSplitCount } from "@/lib/utils/split";

export type TransactionActionResult =
  | { ok: true }
  | { ok: false; error: string };

type SubmitInput = {
  id?: string;
  amount: number;
  categoryId: string | null;
  spentAt: string; // ISO date or ISO datetime
  memo?: string | null;
  paymentMethod: PaymentMethod;
  /** 할부 개월 수. undefined/1 = 일시불(단일 행). >=2 = 신용 할부(N 자식 행,
   *  create 시에만 적용 — 편집에는 무시). */
  installmentMonths?: number;
  /** N명 나눠내기(정산). 나눴을 때만 count(2..4) + total(총액)이 온다. amount는
   *  이미 내 몫(round(total/count))으로 계산돼 들어온다. 안 나눴으면 둘 다 생략. */
  splitCount?: number | null;
  splitTotal?: number | null;
  visibility?: TransactionVisibility;
  groupIds?: string[] | null;
};

const MEMO_MAX_LENGTH = 100;
const VALID_VISIBILITIES: TransactionVisibility[] = ["all", "groups", "private"];

function normalizeMemo(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeSpentAt(value: string): string {
  // Accept "YYYY-MM-DD" → "YYYY-MM-DDT00:00:00Z" so it lands at start of day UTC.
  // Skip the future check here: server TZ ≠ client TZ, and a same-day local
  // entry submitted early morning (KST) maps to a UTC midnight that may look
  // "future" relative to UTC now. Calendar UI already blocks future date pick.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00Z`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("올바른 날짜를 입력해주세요.");
  }
  // Full datetime carries a real instant — reject future.
  if (parsed.getTime() > Date.now()) {
    throw new Error("미래 시간은 기록할 수 없어요.");
  }
  return parsed.toISOString();
}

export async function submitTransactionAction(
  input: SubmitInput,
): Promise<TransactionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "금액은 0원보다 커야 해요." };
  }

  let spentAt: string;
  try {
    spentAt = normalizeSpentAt(input.spentAt);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "날짜 오류",
    };
  }

  const memo = normalizeMemo(input.memo);
  if (memo !== null && memo.length > MEMO_MAX_LENGTH) {
    return { ok: false, error: `메모는 ${MEMO_MAX_LENGTH}자까지 입력할 수 있어요.` };
  }

  // 결제수단은 필수 — 폼이 항상 신용/체크 중 하나를 보내지만, 변조된 클라이언트가
  // 빈 값/잘못된 값을 넣지 못하게 서버 경계에서 한 번 더 막는다.
  if (!isPaymentMethod(input.paymentMethod)) {
    return { ok: false, error: "결제수단을 선택해주세요." };
  }
  const paymentMethod = input.paymentMethod;

  // N명 나눠내기(정산): 폼은 나눴을 때만 count(2..4)+total을 보낸다. amount는 이미 내
  // 몫으로 계산돼 들어오므로 여기선 표시용 메타(count/total)만 검증한다. 안 나눴으면 둘
  // 다 null로 떨어진다. 변조 클라이언트가 잘못된 조합을 넣지 못하게 서버 경계에서 막는다.
  let splitCount: number | null = null;
  let splitTotal: number | null = null;
  if (input.splitCount != null && input.splitCount >= 2) {
    if (!isValidSplitCount(input.splitCount)) {
      return { ok: false, error: "나눌 인원은 2~4명이에요." };
    }
    if (
      input.splitTotal == null ||
      !Number.isFinite(input.splitTotal) ||
      input.splitTotal <= 0
    ) {
      return { ok: false, error: "나눠낼 총액을 확인해주세요." };
    }
    if (input.splitTotal < input.amount) {
      return { ok: false, error: "나눠낼 총액이 내 몫보다 작을 수 없어요." };
    }
    splitCount = input.splitCount;
    splitTotal = Math.round(input.splitTotal);
  }

  const visibility: TransactionVisibility =
    input.visibility && VALID_VISIBILITIES.includes(input.visibility)
      ? input.visibility
      : "all";

  // visibility='groups' requires at least one group id, otherwise the row
  // would be hidden from everyone (equivalent to 'private' but tagged
  // 'groups'). Block at the server boundary so a tampered client can't sneak
  // it through.
  const groupIds =
    visibility === "groups"
      ? Array.from(
          new Set(
            (input.groupIds ?? []).filter(
              (id): id is string => typeof id === "string" && id.length > 0,
            ),
          ),
        )
      : [];
  if (visibility === "groups" && groupIds.length === 0) {
    return {
      ok: false,
      error: "공개할 그룹을 한 개 이상 선택해주세요.",
    };
  }

  if (input.id) {
    const { error } = await supabase.rpc("update_transaction_with_visibility", {
      p_id: input.id,
      p_amount: input.amount,
      p_category_id: input.categoryId,
      p_spent_at: spentAt,
      p_memo: memo,
      p_visibility: visibility,
      p_group_ids: groupIds.length > 0 ? groupIds : null,
      p_payment_method: paymentMethod,
      p_split_count: splitCount,
      p_split_total: splitTotal,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    // 할부(installment): months>=2 이면 원금을 N회차 자식 행으로 펼쳐 한 RPC로
    // 원자 생성한다. 신용 전용. (create 경로에서만 — 편집엔 할부 없음.)
    const months = input.installmentMonths;
    if (months != null && months >= 2) {
      if (splitCount !== null) {
        return {
          ok: false,
          error: "할부와 나눠내기는 함께 쓸 수 없어요.",
        };
      }
      if (paymentMethod !== "credit") {
        return { ok: false, error: "할부는 신용카드만 가능해요." };
      }
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.spentAt);
      if (!m) return { ok: false, error: "올바른 날짜를 입력해주세요." };
      // 구매일을 로컬 벽시계 날짜로 파싱 → 스케줄이 매달 같은 day에 회차를 놓는다.
      const firstDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      let schedule;
      try {
        schedule = installmentSchedule(input.amount, months, firstDate);
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "할부 계산 오류",
        };
      }
      const rows = schedule.map((entry) => ({
        id: randomUUID(),
        amount: entry.amount,
        spent_at: `${entry.spentAt}T00:00:00Z`,
        seq: entry.seq,
      }));
      const { error } = await supabase.rpc("create_installment_transactions", {
        p_installment_id: randomUUID(),
        p_count: months,
        p_rows: rows,
        p_category_id: input.categoryId,
        p_memo: memo,
        p_visibility: visibility,
        p_group_ids: groupIds.length > 0 ? groupIds : null,
      });
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard");
      return { ok: true };
    }

    const id = randomUUID();
    const { error } = await supabase.rpc("create_transaction_with_visibility", {
      p_id: id,
      p_amount: input.amount,
      p_category_id: input.categoryId,
      p_spent_at: spentAt,
      p_memo: memo,
      p_visibility: visibility,
      p_group_ids: groupIds.length > 0 ? groupIds : null,
      p_payment_method: paymentMethod,
      p_split_count: splitCount,
      p_split_total: splitTotal,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export type SearchMemoResultItem = {
  id: string;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  spent_at: string;
  memo: string;
};

export type SearchMemoActionResult =
  | { ok: true; items: SearchMemoResultItem[]; truncated: boolean }
  | { ok: false; error: string };

const SEARCH_LIMIT = 100;
const SEARCH_QUERY_MAX_LENGTH = 100;

// Escape SQL LIKE wildcards so a user-typed `%`/`_` is matched literally instead
// of acting as a pattern. The leading backslash escapes itself so a typed
// backslash still survives as a literal.
function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/[%_]/g, (m) => `\\${m}`);
}

export async function searchTransactionsByMemoAction(
  rawQuery: string,
): Promise<SearchMemoActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const query = (rawQuery ?? "").trim();
  if (query.length === 0) return { ok: true, items: [], truncated: false };
  if (query.length > SEARCH_QUERY_MAX_LENGTH) {
    return { ok: false, error: "검색어가 너무 길어요." };
  }

  const pattern = `%${escapeLikePattern(query)}%`;

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, amount, category_id, spent_at, memo, categories ( name, icon, color )",
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .not("memo", "is", null)
    .ilike("memo", pattern)
    // Exclude future-dated rows — 할부(installment) materializes future 회차 that
    // share the memo; without this bound they'd surface at the top (spent_at desc).
    // nowInSeoul (not UTC now): spent_at is stored at KST-date midnight UTC, so a
    // raw UTC now would drop today's rows during 00:00–09:00 KST on a UTC host.
    .lte("spent_at", nowInSeoul().toISOString())
    .order("spent_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(SEARCH_LIMIT + 1);

  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as Array<{
    id: string;
    amount: number;
    category_id: string | null;
    spent_at: string;
    memo: string | null;
    categories: {
      name: string | null;
      icon: string | null;
      color: string | null;
    } | null;
  }>;

  const truncated = rows.length > SEARCH_LIMIT;
  const trimmed = truncated ? rows.slice(0, SEARCH_LIMIT) : rows;

  const items: SearchMemoResultItem[] = trimmed
    .filter((row): row is typeof row & { memo: string } => row.memo != null)
    .map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      category_id: row.category_id,
      category_name: row.categories?.name ?? null,
      category_icon: row.categories?.icon ?? null,
      category_color: row.categories?.color ?? null,
      spent_at: row.spent_at,
      memo: row.memo,
    }));

  return { ok: true, items, truncated };
}

export async function deleteTransactionAction(
  id: string,
): Promise<TransactionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!id) return { ok: false, error: "삭제할 항목이 없어요." };

  // 할부 자식이면 그룹 전체를 삭제한다(개별 회차 삭제는 합을 깨므로 불가 — v1은
  // 전체 삭제만). 일반 거래는 단일 행. RLS로 user_id 펜스.
  const { data: row } = await supabase
    .from("transactions")
    .select("installment_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  const deletion = supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("deleted_at", null);
  const { error } = row?.installment_id
    ? await deletion.eq("installment_id", row.installment_id)
    : await deletion.eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

// -- Income adjustments -----------------------------------------------------
//
// Per-cycle one-shot income (bonus, refund, side income) that supplements
// the recurring `user_settings.monthly_income`. Adjustments are summed by
// the dashboard whenever their `occurred_on` falls inside the current
// budget cycle, then folded into `effectiveIncome` for spendingRate /
// remainingBudget. Friend mode never reads this table — RLS only grants
// access to the owning user.

export type IncomeAdjustmentActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const INCOME_MEMO_MAX_LENGTH = 100;
const INCOME_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function normalizeOccurredOn(value: string): string {
  if (!INCOME_DATE_RE.test(value)) {
    throw new Error("올바른 날짜를 입력해주세요.");
  }
  // The DB column is `date`, so we keep the YYYY-MM-DD string as-is to
  // avoid Date round-trips that would re-introduce timezone drift.
  // Future-date check: parse in local tz and compare against today's date
  // (also local). The product's mental model is "what happened" tracking,
  // not budget projection — block future entries the same way the
  // transaction form does.
  const [, ys, ms, ds] = INCOME_DATE_RE.exec(value)!;
  const target = new Date(Number(ys), Number(ms) - 1, Number(ds));
  // KST wall-clock today — `new Date()` would be UTC on Vercel, wrongly
  // rejecting an entry dated *today* (KST) during 00:00-09:00 KST as "future".
  const now = nowInSeoul();
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  if (target.getTime() > todayEnd.getTime()) {
    throw new Error("미래 날짜는 등록할 수 없어요.");
  }
  return value;
}

export async function addIncomeAdjustmentAction(input: {
  amount: number;
  occurredOn: string;
  memo?: string | null;
}): Promise<IncomeAdjustmentActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "금액은 0원보다 커야 해요." };
  }

  let occurredOn: string;
  try {
    occurredOn = normalizeOccurredOn(input.occurredOn);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "날짜 오류",
    };
  }

  const memo = normalizeMemo(input.memo);
  if (memo !== null && memo.length > INCOME_MEMO_MAX_LENGTH) {
    return {
      ok: false,
      error: `메모는 ${INCOME_MEMO_MAX_LENGTH}자까지 입력할 수 있어요.`,
    };
  }

  const id = randomUUID();
  const { error } = await supabase.from("income_adjustments").insert({
    id,
    user_id: user.id,
    occurred_on: occurredOn,
    amount: input.amount,
    memo,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true, id };
}

export async function updateIncomeAdjustmentAction(input: {
  id: string;
  amount: number;
  occurredOn: string;
  memo?: string | null;
}): Promise<TransactionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!input.id) return { ok: false, error: "수정할 항목이 없어요." };

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "금액은 0원보다 커야 해요." };
  }

  let occurredOn: string;
  try {
    occurredOn = normalizeOccurredOn(input.occurredOn);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "날짜 오류",
    };
  }

  const memo = normalizeMemo(input.memo);
  if (memo !== null && memo.length > INCOME_MEMO_MAX_LENGTH) {
    return {
      ok: false,
      error: `메모는 ${INCOME_MEMO_MAX_LENGTH}자까지 입력할 수 있어요.`,
    };
  }

  const { error } = await supabase
    .from("income_adjustments")
    .update({ occurred_on: occurredOn, amount: input.amount, memo })
    .eq("id", input.id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteIncomeAdjustmentAction(
  id: string,
): Promise<TransactionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!id) return { ok: false, error: "삭제할 항목이 없어요." };

  const { error } = await supabase
    .from("income_adjustments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

// -- Per-cycle fixed-expense amount override ---------------------------------
//
// "이번 달 실제 금액" for a single fixed expense, scoped to one budget cycle.
// Keyed by cycle_anchor "YYYY-MM" (the anchorYm the dashboard already computes).
// The base fixed_expenses.amount is untouched; with no override row the
// effective amount falls back to base (next cycle auto-reverts). Revert = delete.
// Friend visibility is served by the get_fixed_effective_items /
// get_friend_fixed_total RPCs, never by these writes (owner-only).

const CYCLE_ANCHOR_RE = /^\d{4}-\d{2}$/;

export async function upsertFixedOverrideAction(input: {
  fixedExpenseId: string;
  cycleAnchor: string;
  amount: number;
}): Promise<TransactionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!input.fixedExpenseId) return { ok: false, error: "대상이 없어요." };
  if (!CYCLE_ANCHOR_RE.test(input.cycleAnchor)) {
    return { ok: false, error: "주기 정보가 올바르지 않아요." };
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { ok: false, error: "금액은 0원 이상이어야 해요." };
  }
  const amount = Math.round(input.amount);

  // Verify the fixed expense belongs to the caller before writing an override
  // for it. RLS already fences user_id = auth.uid() on the override row, but
  // the FK alone does not check ownership of the referenced expense.
  const { data: owned, error: ownErr } = await supabase
    .from("fixed_expenses")
    .select("id")
    .eq("id", input.fixedExpenseId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (ownErr) return { ok: false, error: ownErr.message };
  if (!owned) return { ok: false, error: "고정지출을 찾을 수 없어요." };

  const { error } = await supabase
    .from("fixed_expense_overrides")
    .upsert(
      {
        user_id: user.id,
        fixed_expense_id: input.fixedExpenseId,
        cycle_anchor: input.cycleAnchor,
        amount,
        // True instant (nowInSeoul() is a wall-clock-shifted Date, wrong for a
        // timestamptz). updated_at is not read for logic — kept accurate anyway.
        updated_at: new Date().toISOString(),
      },
      { onConflict: "fixed_expense_id,cycle_anchor" },
    );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteFixedOverrideAction(input: {
  fixedExpenseId: string;
  cycleAnchor: string;
}): Promise<TransactionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!input.fixedExpenseId) return { ok: false, error: "대상이 없어요." };
  if (!CYCLE_ANCHOR_RE.test(input.cycleAnchor)) {
    return { ok: false, error: "주기 정보가 올바르지 않아요." };
  }

  const { error } = await supabase
    .from("fixed_expense_overrides")
    .delete()
    .eq("fixed_expense_id", input.fixedExpenseId)
    .eq("cycle_anchor", input.cycleAnchor)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Schedule a previously-undated fixed expense from the dashboard calendar:
 * set its `payment_day` (so it surfaces on the grid) and, optionally, this
 * cycle's amount as an override. The amount is per-cycle only ("이번 달만") —
 * the recurring base amount is left untouched, mirroring the override flow.
 *
 * `payment_day` is a base property surfaced on /fixed-expenses too, so this
 * revalidates the same set as updateFixedExpenseAction (NOT dashboard-only,
 * or /fixed-expenses would keep showing the item as "날짜 미정").
 */
export async function scheduleUndatedFixedAction(input: {
  fixedExpenseId: string;
  cycleAnchor: string;
  paymentDay: number;
  amount: number | null;
}): Promise<TransactionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!input.fixedExpenseId) return { ok: false, error: "대상이 없어요." };
  if (!CYCLE_ANCHOR_RE.test(input.cycleAnchor)) {
    return { ok: false, error: "주기 정보가 올바르지 않아요." };
  }
  // The whole point is leaving the "날짜 미정" state — isValidPaymentDay treats
  // null as valid (unspecified), so reject null explicitly before that check.
  if (input.paymentDay === null || input.paymentDay === undefined) {
    return { ok: false, error: "날짜를 선택해주세요." };
  }
  if (!isValidPaymentDay(input.paymentDay)) {
    return { ok: false, error: "결제일이 올바르지 않아요." };
  }
  if (input.amount !== null) {
    if (!Number.isFinite(input.amount) || input.amount < 0) {
      return { ok: false, error: "금액은 0원 이상이어야 해요." };
    }
  }

  // Verify ownership before mutating either table. RLS fences both, but the
  // friendly error path needs the row first anyway.
  const { data: owned, error: ownErr } = await supabase
    .from("fixed_expenses")
    .select("id")
    .eq("id", input.fixedExpenseId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (ownErr) return { ok: false, error: ownErr.message };
  if (!owned) return { ok: false, error: "고정지출을 찾을 수 없어요." };

  // 1) Date — base property, surfaces the item on the grid. Nothing is
  // committed yet, so a failure here needs no revalidate.
  const { error: dateErr } = await supabase
    .from("fixed_expenses")
    .update({ payment_day: input.paymentDay })
    .eq("id", input.fixedExpenseId)
    .eq("user_id", user.id);
  if (dateErr) return { ok: false, error: dateErr.message };

  // 2) Amount — this cycle only. Skip when left blank ("금액 미입력").
  let amountError: string | null = null;
  if (input.amount !== null) {
    const amount = Math.round(input.amount);
    const { error: amtErr } = await supabase
      .from("fixed_expense_overrides")
      .upsert(
        {
          user_id: user.id,
          fixed_expense_id: input.fixedExpenseId,
          cycle_anchor: input.cycleAnchor,
          amount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "fixed_expense_id,cycle_anchor" },
      );
    if (amtErr) amountError = amtErr.message;
  }

  // The date write already committed regardless of the override result — always
  // revalidate so the grid stops showing the item as "날짜 미정", THEN surface
  // any amount error (the item is scheduled either way, just without an
  // override for this cycle).
  revalidatePath("/fixed-expenses");
  revalidatePath("/dashboard");
  revalidatePath("/settings");

  if (amountError) return { ok: false, error: amountError };
  return { ok: true };
}

// -- Custom categories ------------------------------------------------------
//
// Per-user custom spending categories (create/update/delete). Seeds
// (user_id is null) are shared and read-only. icon/color are validated
// against the app's fixed allowlists here (not in the DB) because they expand
// often — the DB only checks name length. Deletion reassigns the user's
// transactions to the shared 기타 seed via the delete_category RPC.

export type CategoryActionCategory = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  isCustom: boolean;
};

export type CategoryMutationResult =
  | { ok: true; category: CategoryActionCategory }
  | { ok: false; error: string };

const CATEGORY_NAME_MAX_LENGTH = 10;
const CATEGORY_MAX_CUSTOM = 20;
const CATEGORY_ICON_SET = new Set(CATEGORY_ICON_SLUGS);
const CATEGORY_COLOR_SET = new Set(CATEGORY_COLORS);

function normalizeCategoryName(value: string): string {
  return (value ?? "").trim();
}

type ValidatedCategoryInput = {
  name: string;
  icon: string;
  color: string;
};

function validateCategoryInput(input: {
  name: string;
  icon: string;
  color: string;
}): { ok: true; value: ValidatedCategoryInput } | { ok: false; error: string } {
  const name = normalizeCategoryName(input.name);
  if (name.length === 0) {
    return { ok: false, error: "카테고리 이름을 입력해주세요." };
  }
  if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `이름은 ${CATEGORY_NAME_MAX_LENGTH}자까지 입력할 수 있어요.`,
    };
  }
  if (!CATEGORY_ICON_SET.has(input.icon)) {
    return { ok: false, error: "아이콘을 선택해주세요." };
  }
  if (!CATEGORY_COLOR_SET.has(input.color)) {
    return { ok: false, error: "색상을 선택해주세요." };
  }
  return { ok: true, value: { name, icon: input.icon, color: input.color } };
}

// Postgres unique_violation (duplicate name) → friendly Korean copy.
function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === "23505";
}

export async function createCategoryAction(input: {
  name: string;
  icon: string;
  color: string;
}): Promise<CategoryMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const validated = validateCategoryInput(input);
  if (!validated.ok) return validated;
  const { name, icon, color } = validated.value;

  const { count, error: countError } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) return { ok: false, error: countError.message };
  if ((count ?? 0) >= CATEGORY_MAX_CUSTOM) {
    return {
      ok: false,
      error: `카테고리는 최대 ${CATEGORY_MAX_CUSTOM}개까지 만들 수 있어요.`,
    };
  }

  const id = randomUUID();
  const { error } = await supabase
    .from("categories")
    .insert({ id, user_id: user.id, name, icon, color });
  if (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "같은 이름의 카테고리가 이미 있어요." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true, category: { id, name, icon, color, isCustom: true } };
}

export async function updateCategoryAction(input: {
  id: string;
  name: string;
  icon: string;
  color: string;
}): Promise<CategoryMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!input.id) return { ok: false, error: "수정할 카테고리가 없어요." };

  const validated = validateCategoryInput(input);
  if (!validated.ok) return validated;
  const { name, icon, color } = validated.value;

  // Ownership is fenced by RLS (eq user_id is redundant safety). Seed rows
  // (user_id is null) never match eq("user_id", user.id) so they can't be
  // edited through this path.
  const { error } = await supabase
    .from("categories")
    .update({ name, icon, color })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "같은 이름의 카테고리가 이미 있어요." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return {
    ok: true,
    category: { id: input.id, name, icon, color, isCustom: true },
  };
}

export async function deleteCategoryAction(
  id: string,
): Promise<TransactionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!id) return { ok: false, error: "삭제할 카테고리가 없어요." };

  // delete_category reassigns this category's transactions to the 기타 seed,
  // then deletes the row — atomic, SECURITY DEFINER, own-only.
  const { error } = await supabase.rpc("delete_category", { p_id: id });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
