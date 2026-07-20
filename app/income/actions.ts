"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { nowInSeoul } from "@/lib/utils/date";

// -- Income surface actions ---------------------------------------------------
//
// Moved here from app/settings/actions.ts (saveIncomeAction) and
// app/dashboard/actions.ts (income adjustments) when the income tab became
// the single income surface. Per-cycle one-shot income (bonus, refund, side
// income) supplements the recurring `user_settings.monthly_income`; both are
// folded into effectiveIncome by the dashboard budget math. Friend mode never
// reads income_adjustments — RLS only grants access to the owning user.

type ActionResult = { ok: true } | { ok: false; error: string };

export type IncomeAdjustmentActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const INCOME_MEMO_MAX_LENGTH = 100;
const INCOME_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function normalizeMemo(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

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

export async function saveIncomeAction(income: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!Number.isFinite(income) || income < 0) {
    return { ok: false, error: "0원 이상으로 입력해주세요." };
  }
  const monthlyIncome = Math.trunc(income);

  // Partial upsert: only monthly_income. On a first-time insert the other
  // user_settings columns fall back to their DB defaults (payday=1,
  // payroll_rule='prev'); on update the untouched columns are preserved.
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, monthly_income: monthlyIncome },
      { onConflict: "user_id" },
    );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true };
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

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true, id };
}

export async function updateIncomeAdjustmentAction(input: {
  id: string;
  amount: number;
  occurredOn: string;
  memo?: string | null;
}): Promise<ActionResult> {
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

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteIncomeAdjustmentAction(
  id: string,
): Promise<ActionResult> {
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

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true };
}
