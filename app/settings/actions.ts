"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseAmountInput } from "@/lib/utils/money";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const monthlyIncome = parseAmountInput(
    String(formData.get("monthly_income") ?? "0"),
  );
  const fixedExpense = parseAmountInput(
    String(formData.get("fixed_expense") ?? "0"),
  );

  if (monthlyIncome < 0 || fixedExpense < 0) {
    return { ok: false, error: "0원 이상으로 입력해주세요." };
  }
  if (fixedExpense > monthlyIncome) {
    return { ok: false, error: "고정지출이 월 수입보다 클 수 없어요." };
  }

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: user.id,
        monthly_income: monthlyIncome,
        fixed_expense: fixedExpense,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true };
}
