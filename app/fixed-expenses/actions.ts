"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isValidPaymentDay } from "@/lib/utils/payment-day";

export type FixedExpenseActionResult =
  | { ok: true }
  | { ok: false; error: string };

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function validateAmount(amount: number): FixedExpenseActionResult | null {
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "금액은 0원 이상이어야 해요." };
  }
  return null;
}

function validateName(name: string): FixedExpenseActionResult | null {
  if (name.length === 0) {
    return { ok: false, error: "이름을 입력해주세요." };
  }
  if (name.length > 40) {
    return { ok: false, error: "이름은 40자 이내로 입력해주세요." };
  }
  return null;
}

function validatePaymentDay(
  value: number | null | undefined,
): FixedExpenseActionResult | null {
  if (value === null || value === undefined) return null;
  if (!isValidPaymentDay(value)) {
    return { ok: false, error: "결제일은 1일부터 31일 사이 또는 말일로 선택해주세요." };
  }
  return null;
}

function revalidate() {
  revalidatePath("/fixed-expenses");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/**
 * Activate (or re-activate) a catalog plan as a fixed expense for the user.
 * - If the user has never added this plan: insert a new row.
 * - If the user previously had it (is_active = false): flip is_active back on
 *   and update the amount.
 */
export async function activateCatalogPlanAction(input: {
  planId: string;
  amount: number;
  payment_day?: number | null;
}): Promise<FixedExpenseActionResult> {
  const { supabase, user } = await requireUser();

  const amountError = validateAmount(input.amount);
  if (amountError) return amountError;

  const paymentDayError = validatePaymentDay(input.payment_day);
  if (paymentDayError) return paymentDayError;
  const payment_day = input.payment_day ?? null;

  // Look up the catalog row to copy name/category at the time of activation.
  const { data: plan, error: planError } = await supabase
    .from("subscription_plans")
    .select("id, service_name, plan_name, category")
    .eq("id", input.planId)
    .maybeSingle();

  if (planError) return { ok: false, error: planError.message };
  if (!plan) return { ok: false, error: "카탈로그 항목을 찾을 수 없어요." };

  const label = plan.plan_name
    ? `${plan.service_name} ${plan.plan_name}`
    : plan.service_name;
  const name = label.slice(0, 40);
  const amount = Math.round(input.amount);

  // Check whether the user already has this plan (active or deactivated).
  const { data: existing, error: existingError } = await supabase
    .from("fixed_expenses")
    .select("id")
    .eq("user_id", user.id)
    .eq("subscription_plan_id", input.planId)
    .maybeSingle();

  if (existingError) return { ok: false, error: existingError.message };

  if (existing) {
    const { error } = await supabase
      .from("fixed_expenses")
      .update({
        is_active: true,
        amount,
        name,
        category: plan.category,
        payment_day,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("fixed_expenses").insert({
      id: randomUUID(),
      user_id: user.id,
      subscription_plan_id: plan.id,
      name,
      amount,
      category: plan.category,
      is_active: true,
      payment_day,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidate();
  return { ok: true };
}

/** Update the amount (and optionally the display name) of an active item. */
export async function updateFixedExpenseAction(input: {
  id: string;
  amount: number;
  name?: string;
  plan_name?: string | null;
  payment_day?: number | null;
}): Promise<FixedExpenseActionResult> {
  const { supabase, user } = await requireUser();

  const amountError = validateAmount(input.amount);
  if (amountError) return amountError;

  if (input.payment_day !== undefined) {
    const paymentDayError = validatePaymentDay(input.payment_day);
    if (paymentDayError) return paymentDayError;
  }

  const patch: {
    amount: number;
    name?: string;
    plan_name?: string | null;
    payment_day?: number | null;
  } = {
    amount: Math.round(input.amount),
  };

  if (input.payment_day !== undefined) {
    patch.payment_day = input.payment_day;
  }

  if (typeof input.name === "string") {
    const normalized = normalizeName(input.name);
    const nameError = validateName(normalized);
    if (nameError) return nameError;
    patch.name = normalized;
  }

  if (input.plan_name !== undefined) {
    if (input.plan_name === null) {
      patch.plan_name = null;
    } else {
      const normalized = normalizeName(input.plan_name);
      if (normalized.length > 40) {
        return { ok: false, error: "플랜은 40자 이내로 입력해주세요." };
      }
      patch.plan_name = normalized.length > 0 ? normalized : null;
    }
  }

  const { error } = await supabase
    .from("fixed_expenses")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

/** "해제" — keeps the row in DB so toggling back on restores the amount. */
export async function deactivateFixedExpenseAction(
  id: string,
): Promise<FixedExpenseActionResult> {
  const { supabase, user } = await requireUser();

  if (!id) return { ok: false, error: "잘못된 요청이에요." };

  const { error } = await supabase
    .from("fixed_expenses")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

/** Hard delete — used for manual ("직접 추가") items. */
export async function deleteFixedExpenseAction(
  id: string,
): Promise<FixedExpenseActionResult> {
  const { supabase, user } = await requireUser();

  if (!id) return { ok: false, error: "잘못된 요청이에요." };

  const { error } = await supabase
    .from("fixed_expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

/** Add a manual item that isn't in the shared catalog. */
export async function addManualFixedExpenseAction(input: {
  name: string;
  amount: number;
  category?: string | null;
  plan_name?: string | null;
  payment_day?: number | null;
}): Promise<FixedExpenseActionResult> {
  const { supabase, user } = await requireUser();

  const name = normalizeName(input.name);
  const nameError = validateName(name);
  if (nameError) return nameError;

  const amountError = validateAmount(input.amount);
  if (amountError) return amountError;

  const paymentDayError = validatePaymentDay(input.payment_day);
  if (paymentDayError) return paymentDayError;
  const payment_day = input.payment_day ?? null;

  const planNameRaw =
    typeof input.plan_name === "string" ? normalizeName(input.plan_name) : "";
  if (planNameRaw.length > 40) {
    return { ok: false, error: "플랜은 40자 이내로 입력해주세요." };
  }
  const plan_name = planNameRaw.length > 0 ? planNameRaw : null;

  const { error } = await supabase.from("fixed_expenses").insert({
    id: randomUUID(),
    user_id: user.id,
    subscription_plan_id: null,
    name,
    plan_name,
    amount: Math.round(input.amount),
    category: input.category ?? null,
    is_active: true,
    payment_day,
  });

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}
