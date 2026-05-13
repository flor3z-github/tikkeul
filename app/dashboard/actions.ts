"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type TransactionActionResult =
  | { ok: true }
  | { ok: false; error: string };

type SubmitInput = {
  id?: string;
  amount: number;
  categoryId: string | null;
  spentAt: string; // ISO date or ISO datetime
  memo?: string | null;
};

const MEMO_MAX_LENGTH = 100;

function normalizeMemo(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeSpentAt(value: string): string {
  // Accept "YYYY-MM-DD" → "YYYY-MM-DDT00:00:00Z" so it lands at start of day UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00Z`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("올바른 날짜를 입력해주세요.");
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

  if (input.id) {
    const { error } = await supabase
      .from("transactions")
      .update({
        amount: input.amount,
        category_id: input.categoryId,
        spent_at: spentAt,
        memo,
      })
      .eq("id", input.id)
      .eq("user_id", user.id);

    if (error) return { ok: false, error: error.message };
  } else {
    const id = randomUUID();
    const { error } = await supabase.from("transactions").insert({
      id,
      user_id: user.id,
      amount: input.amount,
      category_id: input.categoryId,
      spent_at: spentAt,
      memo,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
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

  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
