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
export async function sendMessageAction(
  threadId: string,
  content: string,
  quotedTransactionId: string | null,
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

  const { error } = await supabase.from("dm_messages").insert({
    thread_id: threadId,
    sender_id: user.id,
    content: trimmed,
    quoted_transaction_id: quotedTransactionId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dm/${friendId}`);
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
