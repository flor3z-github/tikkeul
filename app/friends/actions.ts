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
