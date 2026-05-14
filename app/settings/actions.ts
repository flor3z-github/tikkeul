"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseAmountInput } from "@/lib/utils/money";
import { isValidNickname, NICKNAME_MAX_LENGTH } from "@/lib/utils/nickname";
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

  if (monthlyIncome < 0) {
    return { ok: false, error: "0원 이상으로 입력해주세요." };
  }

  const nicknameRaw = String(formData.get("nickname") ?? "").trim();
  if (!isValidNickname(nicknameRaw)) {
    return {
      ok: false,
      error: `닉네임은 1~${NICKNAME_MAX_LENGTH}자로 입력해주세요.`,
    };
  }

  const cycleModeRaw = String(formData.get("cycle_mode") ?? "calendar");
  if (cycleModeRaw !== "calendar" && cycleModeRaw !== "income_day") {
    return { ok: false, error: "예산 주기 모드가 올바르지 않아요." };
  }
  const cycleMode = cycleModeRaw as "calendar" | "income_day";

  const cycleStartDay = Number(formData.get("cycle_start_day") ?? 1);
  if (
    !Number.isInteger(cycleStartDay) ||
    cycleStartDay < 1 ||
    cycleStartDay > 31
  ) {
    return { ok: false, error: "시작일은 1~31일 사이여야 해요." };
  }

  const { error: settingsError } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: user.id,
        monthly_income: monthlyIncome,
        cycle_mode: cycleMode,
        cycle_start_day: cycleStartDay,
      },
      { onConflict: "user_id" },
    );

  if (settingsError) {
    return { ok: false, error: settingsError.message };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ display_name: nicknameRaw })
    .eq("id", user.id);

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/friends");
  return { ok: true };
}
