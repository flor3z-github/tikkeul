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

// ---------------------------------------------------------------------------
// Friend-spending push notifications
// ---------------------------------------------------------------------------

type PushSubscriptionPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
};

// Upsert the device's push subscription. Called from the client right after
// pushManager.subscribe succeeds. endpoint is the natural unique key — if the
// same device resubscribes we just refresh the keys + last_seen_at.
export async function registerPushSubscriptionAction(
  payload: PushSubscriptionPayload,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!payload.endpoint || !payload.p256dh || !payload.auth) {
    return { ok: false, error: "구독 정보가 올바르지 않아요." };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: payload.endpoint,
      p256dh: payload.p256dh,
      auth: payload.auth,
      user_agent: payload.userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

// Remove the device's push subscription row. Caller passes the endpoint
// returned by unsubscribeDevice() — the row may already be gone, so missing
// rows are not an error.
export async function unregisterPushSubscriptionAction(
  endpoint: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!endpoint) {
    return { ok: false, error: "endpoint가 비어있어요." };
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

// Flip the friend_spending_notifications flag. The flag is the source of
// truth for "should the Edge Function send to this user"; subscriptions stay
// in the table either way so that toggling back on doesn't require a fresh
// permission prompt.
export async function setFriendSpendingNotificationsAction(
  enabled: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, friend_spending_notifications: enabled },
      { onConflict: "user_id" },
    );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}
