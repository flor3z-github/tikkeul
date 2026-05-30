"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseAmountInput } from "@/lib/utils/money";
import { isValidNickname, NICKNAME_MAX_LENGTH } from "@/lib/utils/nickname";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

type FlagResult =
  | { ok: true; anyEnabled: boolean }
  | { ok: false; error: string };

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

  // Model B: payday (0=말일, 1..28) + payroll_rule. cycle_mode/cycle_start_day
  // are no longer written (deprecated-preserved at their backfilled values).
  const payday = Number(formData.get("payday") ?? 1);
  if (!Number.isInteger(payday) || payday < 0 || payday > 28) {
    return { ok: false, error: "급여일이 올바르지 않아요." };
  }

  const payrollRuleRaw = String(formData.get("payroll_rule") ?? "prev");
  if (
    payrollRuleRaw !== "prev" &&
    payrollRuleRaw !== "same" &&
    payrollRuleRaw !== "next"
  ) {
    return { ok: false, error: "급여 규정이 올바르지 않아요." };
  }
  const payrollRule = payrollRuleRaw as "prev" | "same" | "next";

  const { error: settingsError } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: user.id,
        monthly_income: monthlyIncome,
        payday,
        payroll_rule: payrollRule,
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

// Flip the friend_spending_notifications flag and return whether ANY of the
// notification flags remain on after the change. The caller uses that to
// decide whether to keep the device push subscription alive.
export async function setFriendSpendingNotificationsAction(
  enabled: boolean,
): Promise<FlagResult> {
  return updateNotificationFlag("friend_spending_notifications", enabled);
}

// Flip the transaction_interaction_notifications flag (reactions on my own
// transactions + DM messages addressed to me). Independent from
// friend_spending_notifications; see migration 0035.
export async function setTransactionInteractionNotificationsAction(
  enabled: boolean,
): Promise<FlagResult> {
  return updateNotificationFlag(
    "transaction_interaction_notifications",
    enabled,
  );
}

async function updateNotificationFlag(
  column:
    | "friend_spending_notifications"
    | "transaction_interaction_notifications",
  enabled: boolean,
): Promise<FlagResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Branch by column so the upsert payload stays a known-shape literal —
  // Supabase's hand-written types reject computed-key objects (the index
  // signature widens to `never`).
  const upsertPromise =
    column === "friend_spending_notifications"
      ? supabase
          .from("user_settings")
          .upsert(
            { user_id: user.id, friend_spending_notifications: enabled },
            { onConflict: "user_id" },
          )
      : supabase
          .from("user_settings")
          .upsert(
            {
              user_id: user.id,
              transaction_interaction_notifications: enabled,
            },
            { onConflict: "user_id" },
          );

  const { error: upsertError } = await upsertPromise;
  if (upsertError) {
    return { ok: false, error: upsertError.message };
  }

  const { data: row, error: readError } = await supabase
    .from("user_settings")
    .select(
      "friend_spending_notifications, transaction_interaction_notifications",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    return { ok: false, error: readError.message };
  }

  const anyEnabled =
    Boolean(row?.friend_spending_notifications) ||
    Boolean(row?.transaction_interaction_notifications);

  revalidatePath("/settings");
  return { ok: true, anyEnabled };
}
