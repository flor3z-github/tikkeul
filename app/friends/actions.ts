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
import { isValidGroupName, normalizeGroupName } from "@/lib/utils/group";

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

// ---------------------------------------------------------------------------
// Friend groups (Phase 2)
// ---------------------------------------------------------------------------
// Schema lives in 0042; 0044 adds guard triggers (slug immutability, 10-group
// cap, cascade-delete → private). RLS already enforces (a) only the owner can
// touch friend_groups, (b) friend_group_members inserts require an existing
// friendship, (c) seed deletion is blocked by `slug is null` in the delete
// policy. So these actions are mostly thin validators + revalidate calls; the
// DB carries the real invariants.

type CreateGroupResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

type PreviewDeleteResult =
  | { ok: true; orphanCount: number }
  | { ok: false; error: string };

const GROUP_MEMBER_HARD_CAP = 200;

export async function createGroupAction(
  name: string,
  memberIds: string[],
): Promise<CreateGroupResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isValidGroupName(name)) {
    return { ok: false, error: "그룹 이름이 올바르지 않아요." };
  }
  const normalizedName = normalizeGroupName(name);

  // memberIds may legitimately be empty (create the group, add members
  // later). De-duplicate and validate UUID shape; the RLS INSERT policy on
  // friend_group_members re-checks friendship server-side.
  const uniqueMemberIds = Array.from(new Set(memberIds));
  if (uniqueMemberIds.length > GROUP_MEMBER_HARD_CAP) {
    return { ok: false, error: "한 번에 추가할 수 있는 멤버 수를 초과했어요." };
  }
  for (const id of uniqueMemberIds) {
    if (!UUID_RE.test(id) || id === user.id) {
      return { ok: false, error: "잘못된 친구 정보가 포함되어 있어요." };
    }
  }

  // Insert the group first so we have its id. user-defined groups always
  // have slug = null; the seed (slug = 'close') is created only by the
  // handle_new_user trigger.
  const { data: groupRow, error: insertGroupError } = await supabase
    .from("friend_groups")
    .insert({ owner_id: user.id, name: normalizedName, slug: null })
    .select("id")
    .single();

  if (insertGroupError || !groupRow) {
    // 23505 = unique_violation on (owner_id, name)
    const pgCode = (insertGroupError as { code?: string } | null)?.code;
    if (pgCode === "23505") {
      return { ok: false, error: "같은 이름의 그룹이 이미 있어요." };
    }
    // Trigger raises check_violation (errcode 23514) on >10 groups. Surface
    // a friendly message rather than the raw SQL exception.
    if (pgCode === "23514") {
      return { ok: false, error: "그룹은 최대 10개까지 만들 수 있어요." };
    }
    return {
      ok: false,
      error: insertGroupError?.message ?? "그룹을 만들지 못했어요.",
    };
  }

  if (uniqueMemberIds.length > 0) {
    const rows = uniqueMemberIds.map((memberId) => ({
      group_id: groupRow.id as string,
      member_user_id: memberId,
    }));
    // No ON CONFLICT here — duplicates were already de-duplicated above, and
    // the (group_id, member_user_id) PK collision on a fresh insert can only
    // happen via concurrent calls (rare and benign — just return an error).
    const { error: memberError } = await supabase
      .from("friend_group_members")
      .insert(rows);
    if (memberError) {
      // Roll back the group: the RLS DELETE policy allows owner+slug-null,
      // which matches what we just inserted, so this always succeeds when
      // the original INSERT did.
      await supabase
        .from("friend_groups")
        .delete()
        .eq("id", groupRow.id)
        .eq("owner_id", user.id);
      return { ok: false, error: memberError.message };
    }
  }

  revalidatePath("/friends");
  revalidatePath("/friends/groups");
  revalidatePath("/dashboard");
  return { ok: true, id: groupRow.id as string };
}

export async function renameGroupAction(
  groupId: string,
  name: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!UUID_RE.test(groupId)) {
    return { ok: false, error: "잘못된 요청이에요." };
  }
  if (!isValidGroupName(name)) {
    return { ok: false, error: "그룹 이름이 올바르지 않아요." };
  }
  const normalizedName = normalizeGroupName(name);

  // RLS update policy (`auth.uid() = owner_id`) fences the row to the owner.
  // The 0044 slug-immutability trigger blocks any accidental slug change.
  const { data, error } = await supabase
    .from("friend_groups")
    .update({ name: normalizedName })
    .eq("id", groupId)
    .eq("owner_id", user.id)
    .select("id");

  if (error) {
    const pgCode = (error as { code?: string }).code;
    if (pgCode === "23505") {
      return { ok: false, error: "같은 이름의 그룹이 이미 있어요." };
    }
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "그룹을 찾지 못했어요." };
  }

  revalidatePath("/friends");
  revalidatePath("/friends/groups");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function previewDeleteGroupAction(
  groupId: string,
): Promise<PreviewDeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!UUID_RE.test(groupId)) {
    return { ok: false, error: "잘못된 요청이에요." };
  }

  // Confirm ownership before counting — RLS would empty the count anyway,
  // but returning 0 instead of an error is misleading.
  const { data: group, error: groupError } = await supabase
    .from("friend_groups")
    .select("id, slug")
    .eq("id", groupId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (groupError) return { ok: false, error: groupError.message };
  if (!group) return { ok: false, error: "그룹을 찾지 못했어요." };

  // Orphan = a transaction that lists this group AND no other group. After
  // delete, its visibility flips from 'groups' to 'private' (0044 trigger).
  // We need a count of distinct transaction_ids whose only group link is
  // this one. PostgREST can't express "single membership" cleanly, so use
  // the RPC-style approach: pull tx ids in this group, then count those
  // whose total group count is 1.
  //
  // Two-step query keeps things simple. The set size is bounded by the
  // group's footprint and stays small in practice.
  const { data: linkedRows, error: linkedError } = await supabase
    .from("transaction_visibility_groups")
    .select("transaction_id")
    .eq("group_id", groupId);
  if (linkedError) return { ok: false, error: linkedError.message };
  const linkedTxIds = (linkedRows ?? []).map(
    (r) => r.transaction_id as string,
  );
  if (linkedTxIds.length === 0) {
    return { ok: true, orphanCount: 0 };
  }

  // For each linked tx, count its total group links. orphan = links === 1.
  const { data: allLinks, error: allLinksError } = await supabase
    .from("transaction_visibility_groups")
    .select("transaction_id")
    .in("transaction_id", linkedTxIds);
  if (allLinksError) return { ok: false, error: allLinksError.message };

  const linkCountByTx = new Map<string, number>();
  for (const row of allLinks ?? []) {
    const txId = row.transaction_id as string;
    linkCountByTx.set(txId, (linkCountByTx.get(txId) ?? 0) + 1);
  }
  let orphanCount = 0;
  for (const txId of linkedTxIds) {
    if ((linkCountByTx.get(txId) ?? 0) === 1) orphanCount += 1;
  }

  return { ok: true, orphanCount };
}

export async function deleteGroupAction(
  groupId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!UUID_RE.test(groupId)) {
    return { ok: false, error: "잘못된 요청이에요." };
  }

  // RLS delete policy enforces `auth.uid() = owner_id and slug is null`, so
  // the seed group can never be deleted through this path. The 0044 cascade
  // trigger flips orphaned transactions to 'private'.
  const { data, error } = await supabase
    .from("friend_groups")
    .delete()
    .eq("id", groupId)
    .eq("owner_id", user.id)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    // Either the group doesn't exist, isn't owned by us, or is the seed
    // (slug='close'). Surface a generic message — the client doesn't need
    // to distinguish.
    return { ok: false, error: "그룹을 삭제하지 못했어요." };
  }

  revalidatePath("/friends");
  revalidatePath("/friends/groups");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setGroupMembershipAction(
  groupId: string,
  friendUserId: string,
  isMember: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!UUID_RE.test(groupId)) {
    return { ok: false, error: "잘못된 요청이에요." };
  }
  if (!friendUserId || !UUID_RE.test(friendUserId) || friendUserId === user.id) {
    return { ok: false, error: "잘못된 요청이에요." };
  }

  // Confirm group ownership before mutating — RLS would block the write
  // anyway, but returning a clear error is friendlier than a silent no-op.
  const { data: group, error: groupError } = await supabase
    .from("friend_groups")
    .select("id")
    .eq("id", groupId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (groupError) return { ok: false, error: groupError.message };
  if (!group) return { ok: false, error: "그룹을 찾지 못했어요." };

  if (isMember) {
    // ignoreDuplicates: supabase-js's default UPSERT performs UPDATE ON
    // CONFLICT, but the friend_group_members RLS has no UPDATE policy →
    // request fails on any second toggle. Set-membership only ever needs
    // INSERT or DO NOTHING, so ignoreDuplicates is exactly right.
    const { error } = await supabase
      .from("friend_group_members")
      .upsert(
        { group_id: groupId, member_user_id: friendUserId },
        { onConflict: "group_id,member_user_id", ignoreDuplicates: true },
      );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("friend_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("member_user_id", friendUserId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/friends");
  revalidatePath("/friends/groups");
  revalidatePath(`/friends/${friendUserId}`);
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
