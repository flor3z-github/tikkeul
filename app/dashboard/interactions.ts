"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type InteractionActionResult =
  | { ok: true; skipped?: boolean; removed?: boolean }
  | { ok: false; error: string };

const EMOJI_MAX_LENGTH = 16;
const COMMENT_MAX_LENGTH = 500;

// Matches purely-emoji content. Mirrors the regex used on the client and in
// lib/queries/interactions.ts so the "reaction" definition is consistent
// across read and write paths.
const EMOJI_ONLY = /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+$/u;

// A "reaction" is a short DM message whose content is just the emoji and
// whose quoted_transaction_id points at the friend's transaction. Tapping a
// reaction in the dashboard picker behaves as a toggle: tapping an emoji
// that matches the viewer's most recent reaction on the same transaction
// CANCELS the reaction (DELETE the prior message); tapping a different
// emoji APPENDS a new reaction message. There is no debounce-skip path
// anymore — the toggle subsumes the same-emoji-twice case.
export async function sendReactionMessageAction(
  transactionId: string,
  emoji: string,
): Promise<InteractionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!transactionId) return { ok: false, error: "소비를 찾을 수 없어요." };

  const trimmedEmoji = emoji.trim();
  if (trimmedEmoji.length === 0 || trimmedEmoji.length > EMOJI_MAX_LENGTH) {
    return { ok: false, error: "사용할 수 없는 이모지예요." };
  }

  // Pull the transaction owner so we know which DM thread to land in. RLS
  // also gates this read to (a) the owner or (b) a friend with the spending-
  // items perm, which is the same predicate that allows reacting at all.
  const { data: txRow, error: txError } = await supabase
    .from("transactions")
    .select("user_id, deleted_at")
    .eq("id", transactionId)
    .maybeSingle();
  if (txError) return { ok: false, error: txError.message };
  if (!txRow || txRow.deleted_at) {
    return { ok: false, error: "삭제된 소비예요." };
  }
  if (txRow.user_id === user.id) {
    return { ok: false, error: "내 소비에는 반응할 수 없어요." };
  }

  // Atomic get-or-create of the canonical (caller, owner) thread.
  const { data: threadId, error: threadError } = await supabase.rpc(
    "get_or_create_dm_thread",
    { target: txRow.user_id },
  );
  if (threadError || !threadId) {
    return {
      ok: false,
      error: threadError?.message ?? "DM 스레드를 만들지 못했어요.",
    };
  }

  // Look at the viewer's recent messages on THIS transaction to find the
  // most recent emoji-only one — that's the "current reaction" the toggle
  // operates on. Comments interleaved with reactions don't reset the toggle
  // (we ignore them); the latest emoji-only message wins.
  const { data: recentRows, error: recentError } = await supabase
    .from("dm_messages")
    .select("id, content, created_at")
    .eq("thread_id", threadId)
    .eq("sender_id", user.id)
    .eq("quoted_transaction_id", transactionId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (recentError) return { ok: false, error: recentError.message };

  const currentReaction = (recentRows ?? []).find((row) =>
    EMOJI_ONLY.test(row.content.trim()),
  );

  // Same emoji as the current reaction → toggle off (delete the prior msg).
  // RLS allows DELETE only when sender_id = auth.uid(), which is already
  // true by the equality filter above.
  if (currentReaction && currentReaction.content.trim() === trimmedEmoji) {
    const { error: deleteError } = await supabase
      .from("dm_messages")
      .delete()
      .eq("id", currentReaction.id);
    if (deleteError) return { ok: false, error: deleteError.message };

    revalidatePath(`/dm/${txRow.user_id}`);
    revalidatePath("/dashboard");
    return { ok: true, removed: true };
  }

  // Different (or no prior) reaction → insert a new one. We do NOT delete
  // the previous emoji message in the change case — the DM thread keeps the
  // change trail; only the latest one feeds the dashboard heart icon.
  const { error: insertError } = await supabase.from("dm_messages").insert({
    thread_id: threadId,
    sender_id: user.id,
    content: trimmedEmoji,
    quoted_transaction_id: transactionId,
  });
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath(`/dm/${txRow.user_id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

// Inline comment from the friend-mode dashboard. Same DM-thread routing as
// reactions, but the payload is a free-form text body rather than a single
// emoji. We deliberately do NOT toggle here: comments are expected to be
// unique per send, and a "same as last comment" collision is almost always
// intentional (the user is re-sending after realizing the first didn't go).
export async function sendCommentMessageAction(
  transactionId: string,
  content: string,
): Promise<InteractionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!transactionId) return { ok: false, error: "소비를 찾을 수 없어요." };

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "댓글 내용을 입력해주세요." };
  }
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    return { ok: false, error: "댓글이 너무 길어요." };
  }

  const { data: txRow, error: txError } = await supabase
    .from("transactions")
    .select("user_id, deleted_at")
    .eq("id", transactionId)
    .maybeSingle();
  if (txError) return { ok: false, error: txError.message };
  if (!txRow || txRow.deleted_at) {
    return { ok: false, error: "삭제된 소비예요." };
  }
  if (txRow.user_id === user.id) {
    return { ok: false, error: "내 소비에는 댓글을 달 수 없어요." };
  }

  const { data: threadId, error: threadError } = await supabase.rpc(
    "get_or_create_dm_thread",
    { target: txRow.user_id },
  );
  if (threadError || !threadId) {
    return {
      ok: false,
      error: threadError?.message ?? "DM 스레드를 만들지 못했어요.",
    };
  }

  const { error: insertError } = await supabase.from("dm_messages").insert({
    thread_id: threadId,
    sender_id: user.id,
    content: trimmed,
    quoted_transaction_id: transactionId,
  });
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath(`/dm/${txRow.user_id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
