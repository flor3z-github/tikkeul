"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type DmActionResult = { ok: true } | { ok: false; error: string };

const MESSAGE_MAX_LENGTH = 500;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Send a message in a DM thread. The thread must already exist — the page
// resolves (or creates) it via the get_or_create_dm_thread RPC, which is the
// only path that can create a thread. RLS additionally gates the insert: the
// caller must be a thread member, and any quoted_transaction_id must point at
// a live transaction the caller can SELECT.
//
// The caller provides a client-generated UUID as `messageId` so the optimistic
// row rendered in the client can be deduped against the realtime arrival by
// matching ids. If omitted, the DB default generates one.
//
// `replyToMessageId` quotes another message in the same thread (message-to-
// message reply, distinct from `quotedTransactionId` which quotes a spend). RLS
// additionally enforces that the reply target lives in the same thread.
export async function sendMessageAction(
  threadId: string,
  content: string,
  quotedTransactionId: string | null,
  replyToMessageId: string | null = null,
  messageId: string | null = null,
): Promise<DmActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!UUID_RE.test(threadId)) {
    return { ok: false, error: "잘못된 스레드예요." };
  }
  if (
    quotedTransactionId !== null &&
    !UUID_RE.test(quotedTransactionId)
  ) {
    return { ok: false, error: "잘못된 인용이에요." };
  }
  if (replyToMessageId !== null && !UUID_RE.test(replyToMessageId)) {
    return { ok: false, error: "잘못된 답장이에요." };
  }
  if (messageId !== null && !UUID_RE.test(messageId)) {
    return { ok: false, error: "잘못된 메시지 ID예요." };
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "메시지를 입력해주세요." };
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return {
      ok: false,
      error: `메시지는 ${MESSAGE_MAX_LENGTH}자까지 입력할 수 있어요.`,
    };
  }

  // Resolve the friend id from the thread so we can revalidate the right
  // page. RLS gates this read to thread members.
  const { data: thread, error: threadError } = await supabase
    .from("dm_threads")
    .select("user_a_id, user_b_id")
    .eq("id", threadId)
    .maybeSingle();
  if (threadError) return { ok: false, error: threadError.message };
  if (!thread) return { ok: false, error: "스레드를 찾을 수 없어요." };

  const friendId =
    thread.user_a_id === user.id ? thread.user_b_id : thread.user_a_id;

  const insertRow: {
    thread_id: string;
    sender_id: string;
    content: string;
    quoted_transaction_id: string | null;
    reply_to_id: string | null;
    id?: string;
  } = {
    thread_id: threadId,
    sender_id: user.id,
    content: trimmed,
    quoted_transaction_id: quotedTransactionId,
    reply_to_id: replyToMessageId,
  };
  if (messageId) insertRow.id = messageId;

  const { error } = await supabase.from("dm_messages").insert(insertRow);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dm/${friendId}`);
  return { ok: true };
}

// Mark the caller-side of a thread as read and bust the Router Cache for the
// two surfaces that render the unread state: the /dm index badge and the
// dashboard header dot. Both are server-computed from get_my_dm_index, and
// neither can self-refresh on a *read* — read is a dm_threads UPDATE, which is
// not in the supabase_realtime publication, and iOS PWA swipe-back doesn't fire
// RefreshOnRestore's pageshow.persisted (the open realtime WebSocket disqualifies
// the page from bfcache). revalidatePath invalidates those routes' client Router
// Cache so the next back-navigation refetches the read-cleared counts instead of
// serving the staleTimes:30 pre-read snapshot. Called from the chat client on
// mount and on every realtime message arrival (covers messages that land while
// the user is actively viewing the thread).
export async function markThreadReadAction(
  threadId: string,
): Promise<DmActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!UUID_RE.test(threadId)) {
    return { ok: false, error: "잘못된 스레드예요." };
  }

  const { error } = await supabase.rpc("mark_dm_thread_read", {
    p_thread_id: threadId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dm");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteMessageAction(
  messageId: string,
): Promise<DmActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!UUID_RE.test(messageId)) {
    return { ok: false, error: "잘못된 메시지예요." };
  }

  // Resolve the friend id before the row is gone so we can revalidate.
  const { data: msg } = await supabase
    .from("dm_messages")
    .select("thread_id, dm_threads ( user_a_id, user_b_id )")
    .eq("id", messageId)
    .maybeSingle<{
      thread_id: string;
      dm_threads: { user_a_id: string; user_b_id: string } | null;
    }>();

  // RLS allows DELETE only by sender; no extra check needed here.
  const { error } = await supabase
    .from("dm_messages")
    .delete()
    .eq("id", messageId);
  if (error) return { ok: false, error: error.message };

  if (msg?.dm_threads) {
    const friendId =
      msg.dm_threads.user_a_id === user.id
        ? msg.dm_threads.user_b_id
        : msg.dm_threads.user_a_id;
    revalidatePath(`/dm/${friendId}`);
  }
  return { ok: true };
}
