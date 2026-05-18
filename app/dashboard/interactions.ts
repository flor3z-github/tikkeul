"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type InteractionActionResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; error: string };

const EMOJI_MAX_LENGTH = 16;

// A "reaction" is now a short DM message whose content is just the emoji and
// whose quoted_transaction_id points at the friend's transaction. This action
// resolves (or creates) the 1:1 thread between caller and the transaction's
// owner, then inserts the message — with a server-side debounce so that
// tapping the same emoji twice in a row doesn't spam the thread (decision 1b
// from the design discussion).
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

  // Debounce: if the caller's most recent message in this thread is the same
  // emoji on the same quoted transaction, skip the insert. This makes the
  // emoji picker feel idempotent at the UI layer without an explicit toggle
  // semantic and prevents accidental double-taps from inflating the thread.
  const { data: lastMsg, error: lastError } = await supabase
    .from("dm_messages")
    .select("content, quoted_transaction_id, sender_id")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) return { ok: false, error: lastError.message };
  if (
    lastMsg &&
    lastMsg.sender_id === user.id &&
    lastMsg.content === trimmedEmoji &&
    lastMsg.quoted_transaction_id === transactionId
  ) {
    return { ok: true, skipped: true };
  }

  const { error: insertError } = await supabase.from("dm_messages").insert({
    thread_id: threadId,
    sender_id: user.id,
    content: trimmedEmoji,
    quoted_transaction_id: transactionId,
  });
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath(`/dm/${txRow.user_id}`);
  return { ok: true };
}
