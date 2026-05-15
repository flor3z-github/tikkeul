"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  FRIEND_CODE_TTL_MINUTES,
  generateFriendCode,
  isValidFriendCodeFormat,
  normalizeFriendCodeInput,
} from "@/lib/utils/friend-code";

type CreateResult =
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; error: string };

type ActionResult = { ok: true } | { ok: false; error: string };

const REDEEM_WINDOW_SECONDS = 60;
const REDEEM_LIMIT_PER_WINDOW = 5;

export async function createFriendCodeAction(): Promise<CreateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nowIso = new Date().toISOString();

  // Invalidate any active codes the user already issued.
  const { error: invalidateError } = await supabase
    .from("friend_codes")
    .update({ expires_at: nowIso })
    .eq("owner_id", user.id)
    .is("used_at", null)
    .gt("expires_at", nowIso);

  if (invalidateError) {
    return { ok: false, error: invalidateError.message };
  }

  const expiresAt = new Date(
    Date.now() + FRIEND_CODE_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generateFriendCode();
    const { error } = await supabase
      .from("friend_codes")
      .insert({ code, owner_id: user.id, expires_at: expiresAt });
    if (!error) {
      revalidatePath("/friends");
      return { ok: true, code, expiresAt };
    }
    // 23505 = unique_violation; retry. Anything else surfaces.
    const pgCode = (error as { code?: string }).code;
    if (pgCode !== "23505") {
      return { ok: false, error: error.message };
    }
  }

  return { ok: false, error: "코드 생성에 실패했어요. 다시 시도해주세요." };
}

export async function redeemFriendCodeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const code = normalizeFriendCodeInput(String(formData.get("code") ?? ""));
  if (!isValidFriendCodeFormat(code)) {
    return { ok: false, error: "코드 형식이 올바르지 않아요." };
  }

  // Rate limit by recent attempts (uniform per user, regardless of validity).
  const windowStart = new Date(
    Date.now() - REDEEM_WINDOW_SECONDS * 1000,
  ).toISOString();
  const { count: recentCount, error: rateError } = await supabase
    .from("redeem_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("attempted_at", windowStart);
  if (rateError) {
    return { ok: false, error: rateError.message };
  }
  if ((recentCount ?? 0) >= REDEEM_LIMIT_PER_WINDOW) {
    return { ok: false, error: "잠시 후 다시 시도해주세요." };
  }

  const { error: logError } = await supabase
    .from("redeem_attempts")
    .insert({ user_id: user.id });
  if (logError) {
    return { ok: false, error: logError.message };
  }

  const { data: outcome, error: rpcError } = await supabase.rpc(
    "redeem_friend_code",
    { p_code: code },
  );
  if (rpcError) {
    return { ok: false, error: rpcError.message };
  }

  if (outcome === "ok") {
    revalidatePath("/friends");
    revalidatePath("/dashboard");
    return { ok: true };
  }
  if (outcome === "self") {
    return { ok: false, error: "본인 코드는 사용할 수 없어요." };
  }
  if (outcome === "unauthenticated") {
    redirect("/login");
  }
  return { ok: false, error: "유효하지 않은 코드예요." };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VISIBILITY_KEYS = [
  "show_spending_total",
  "show_spending_items",
  "show_fixed_total",
  "show_fixed_items",
] as const;

type FriendVisibilityKey = (typeof VISIBILITY_KEYS)[number];
type FriendVisibilityPatch = Partial<Record<FriendVisibilityKey, boolean>>;

export async function updateFriendVisibilityAction(
  friendUserId: string,
  patch: FriendVisibilityPatch,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!friendUserId || !UUID_RE.test(friendUserId) || friendUserId === user.id) {
    return { ok: false, error: "잘못된 요청이에요." };
  }

  // Whitelist patch keys: only the four boolean flags are settable. Anything
  // else passed in is ignored so a tampered client can't update arbitrary
  // columns via this action.
  const safePatch: FriendVisibilityPatch = {};
  for (const key of VISIBILITY_KEYS) {
    const value = patch[key];
    if (typeof value === "boolean") safePatch[key] = value;
  }
  if (Object.keys(safePatch).length === 0) {
    return { ok: false, error: "변경할 항목이 없어요." };
  }

  // Outbound direction: this user is the owner, friend is the viewer.
  // Idempotent path: read the current row first. If every key in the patch
  // already matches the stored value, return ok without issuing an UPDATE or
  // triggering revalidation. This avoids spurious DB writes and unnecessary
  // route revalidations on rapid identical clicks or duplicate requests.
  const { data: current, error: readError } = await supabase
    .from("friendships")
    .select(
      "show_spending_total, show_spending_items, show_fixed_total, show_fixed_items",
    )
    .eq("owner_id", user.id)
    .eq("viewer_id", friendUserId)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: readError.message };
  }
  if (!current) {
    // Either the friendship doesn't exist or RLS filtered the SELECT out.
    return { ok: false, error: "권한 설정을 저장하지 못했어요." };
  }

  const isNoop = (Object.entries(safePatch) as [FriendVisibilityKey, boolean][])
    .every(([key, value]) => current[key] === value);

  if (isNoop) {
    return { ok: true };
  }

  const { data, error } = await supabase
    .from("friendships")
    .update(safePatch)
    .eq("owner_id", user.id)
    .eq("viewer_id", friendUserId)
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    // Defense-in-depth: a SELECT succeeded above but the UPDATE returned 0
    // rows. Indicates the UPDATE RLS policy is missing or the row vanished
    // between the two queries.
    return { ok: false, error: "권한 설정을 저장하지 못했어요." };
  }

  revalidatePath("/friends");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeFriendAction(
  friendUserId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!friendUserId || friendUserId === user.id) {
    return { ok: false, error: "잘못된 요청이에요." };
  }

  const { error } = await supabase
    .from("friendships")
    .delete()
    .or(
      `and(owner_id.eq.${user.id},viewer_id.eq.${friendUserId}),and(owner_id.eq.${friendUserId},viewer_id.eq.${user.id})`,
    );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/friends");
  revalidatePath("/dashboard");
  return { ok: true };
}
