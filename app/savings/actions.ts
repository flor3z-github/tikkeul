"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isValidPaymentDay } from "@/lib/utils/payment-day";

export type SavingsActionResult = { ok: true } | { ok: false; error: string };

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function validateName(name: string): SavingsActionResult | null {
  if (name.length === 0) return { ok: false, error: "이름을 입력해주세요." };
  if (name.length > 40)
    return { ok: false, error: "이름은 40자 이내로 입력해주세요." };
  return null;
}

// NULL amount = "금액 미입력" — only a provided value is range-checked.
function validateAmount(
  amount: number | null | undefined,
  label = "금액",
): SavingsActionResult | null {
  if (amount === null || amount === undefined) return null;
  if (!Number.isFinite(amount) || amount < 0)
    return { ok: false, error: `${label}은 0원 이상이어야 해요.` };
  return null;
}

function normalizeAmount(amount: number | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  return Math.round(amount);
}

function validatePaymentDay(
  value: number | null | undefined,
): SavingsActionResult | null {
  if (value === null || value === undefined) return null;
  if (!isValidPaymentDay(value))
    return {
      ok: false,
      error: "적립일은 1일부터 31일 사이 또는 말일로 선택해주세요.",
    };
  return null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Accepts a 'YYYY-MM-DD' string and verifies it is a real calendar date.
function validateDate(
  value: string | null | undefined,
  label: string,
  { required }: { required: boolean },
): SavingsActionResult | null {
  if (value === null || value === undefined || value === "") {
    return required ? { ok: false, error: `${label}을 선택해주세요.` } : null;
  }
  if (!ISO_DATE.test(value)) {
    return { ok: false, error: `${label} 형식이 올바르지 않아요.` };
  }
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(y, m - 1, d);
  if (
    probe.getFullYear() !== y ||
    probe.getMonth() !== m - 1 ||
    probe.getDate() !== d
  ) {
    return { ok: false, error: `${label}이 올바르지 않아요.` };
  }
  return null;
}

function revalidate() {
  revalidatePath("/savings");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

type SavingsInput = {
  name: string;
  amount: number | null;
  payment_day?: number | null;
  start_date: string;
  opening_balance?: number | null;
  goal_amount?: number | null;
  maturity_date?: string | null;
};

function validateInput(input: SavingsInput, name: string): SavingsActionResult | null {
  return (
    validateName(name) ??
    validateAmount(input.amount, "월 적립액") ??
    validateAmount(input.opening_balance, "지금까지 모은 돈") ??
    validateAmount(input.goal_amount, "목표 금액") ??
    validatePaymentDay(input.payment_day) ??
    validateDate(input.start_date, "시작일", { required: true }) ??
    validateDate(input.maturity_date, "만기일", { required: false })
  );
}

export async function addSavingsPlanAction(
  input: SavingsInput,
): Promise<SavingsActionResult> {
  const { supabase, user } = await requireUser();

  const name = normalizeName(input.name);
  const error = validateInput(input, name);
  if (error) return error;

  const { error: insertError } = await supabase.from("savings_plans").insert({
    id: randomUUID(),
    user_id: user.id,
    name,
    amount: normalizeAmount(input.amount),
    payment_day: input.payment_day ?? null,
    start_date: input.start_date,
    opening_balance: normalizeAmount(input.opening_balance) ?? 0,
    goal_amount: normalizeAmount(input.goal_amount),
    maturity_date: input.maturity_date || null,
    is_active: true,
  });

  if (insertError) return { ok: false, error: insertError.message };

  revalidate();
  return { ok: true };
}

export async function updateSavingsPlanAction(
  input: SavingsInput & { id: string },
): Promise<SavingsActionResult> {
  const { supabase, user } = await requireUser();

  if (!input.id) return { ok: false, error: "잘못된 요청이에요." };

  const name = normalizeName(input.name);
  const error = validateInput(input, name);
  if (error) return error;

  const { error: updateError } = await supabase
    .from("savings_plans")
    .update({
      name,
      amount: normalizeAmount(input.amount),
      payment_day: input.payment_day ?? null,
      start_date: input.start_date,
      opening_balance: normalizeAmount(input.opening_balance) ?? 0,
      goal_amount: normalizeAmount(input.goal_amount),
      maturity_date: input.maturity_date || null,
    })
    .eq("id", input.id)
    .eq("user_id", user.id);

  if (updateError) return { ok: false, error: updateError.message };

  revalidate();
  return { ok: true };
}

export async function deleteSavingsPlanAction(
  id: string,
): Promise<SavingsActionResult> {
  const { supabase, user } = await requireUser();

  if (!id) return { ok: false, error: "잘못된 요청이에요." };

  const { error } = await supabase
    .from("savings_plans")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}
