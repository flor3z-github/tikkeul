import { createClient } from "@/lib/supabase/server";

// Matches strings made up purely of emoji codepoints (plus the variation
// selectors and zero-width joiners that compose multi-codepoint emoji). Used
// to decide which DM messages render as "reactions" rather than text.
const EMOJI_ONLY = /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+$/u;

export type ViewerInteraction = {
  /** Viewer's most recent emoji-only reaction on this transaction, if any. */
  lastEmoji: string | null;
  /** Viewer's most recent text comment on this transaction, if any. The full
   *  raw content is returned — the caller is responsible for any truncation. */
  lastComment: string | null;
  /** dm_messages.id of the message that produced lastComment. Used to deep-link
   *  the dashboard "comment trace" tap into the DM thread at that message. */
  lastCommentMessageId: string | null;
};

export type ViewerInteractionsByTransaction = Map<string, ViewerInteraction>;

// Returns, for each of the friend's transactions that the viewer has
// interacted with, the viewer's most recent emoji-only reaction and most
// recent text comment. Driven by a single batched read of the viewer→owner
// DM thread's quoted messages, then grouped + classified in JS — no SQL-side
// regex on content.
//
// Result drives both the heart-icon state (lastEmoji) and the read-only
// "last comment" trace next to the message icon in the friend-mode
// transaction list. Comments themselves are never editable from the
// dashboard; the trace is purely informational.
export async function getViewerInteractionsByTransaction(
  viewerId: string,
  ownerId: string,
): Promise<ViewerInteractionsByTransaction> {
  const result: ViewerInteractionsByTransaction = new Map();
  if (!viewerId || !ownerId || viewerId === ownerId) return result;

  const supabase = await createClient();

  // Resolve the canonical (viewer, owner) thread first so the dm_messages read
  // can be narrowed to THIS pair only. Without this filter, an active viewer
  // with many friends would burn the 500-row budget on messages from other
  // threads, dropping older reactions on the currently-viewed friend out of
  // the result set. dm_threads enforces user_a_id < user_b_id, so we sort the
  // two ids lexicographically to hit the unique key directly.
  const [userAId, userBId] =
    viewerId < ownerId ? [viewerId, ownerId] : [ownerId, viewerId];
  const { data: threadRow, error: threadError } = await supabase
    .from("dm_threads")
    .select("id")
    .eq("user_a_id", userAId)
    .eq("user_b_id", userBId)
    .maybeSingle();
  if (threadError || !threadRow) return result;

  // RLS scopes dm_messages to thread members, so an unauthorized request
  // returns an empty array rather than leaking another pair's data.
  const { data, error } = await supabase
    .from("dm_messages")
    .select("id, content, quoted_transaction_id, created_at")
    .eq("thread_id", threadRow.id)
    .eq("sender_id", viewerId)
    .not("quoted_transaction_id", "is", null)
    .order("created_at", { ascending: false })
    // Hard cap so an active thread doesn't pull thousands of rows just to
    // populate per-transaction state. Newest-first ordering means we naturally
    // see the latest emoji/comment per tx first. Now that the query is scoped
    // to a single thread, 500 covers every reasonable history depth.
    .limit(500);

  if (error || !data) return result;

  for (const row of data as Array<{
    id: string;
    content: string;
    quoted_transaction_id: string | null;
  }>) {
    const txId = row.quoted_transaction_id;
    if (!txId) continue;
    const trimmed = row.content.trim();
    if (trimmed.length === 0) continue;
    const isEmoji = EMOJI_ONLY.test(trimmed);

    let entry = result.get(txId);
    if (!entry) {
      entry = {
        lastEmoji: null,
        lastComment: null,
        lastCommentMessageId: null,
      };
      result.set(txId, entry);
    }
    if (isEmoji) {
      if (!entry.lastEmoji) entry.lastEmoji = trimmed;
    } else {
      if (!entry.lastComment) {
        entry.lastComment = trimmed;
        entry.lastCommentMessageId = row.id;
      }
    }
  }
  return result;
}

export type IncomingInteraction = {
  /** Most recent text comment a friend left on the owner's transaction. */
  lastComment: string;
  /** dm_messages.id of that comment — deep-link target for /dm/<sender>?message=. */
  lastCommentMessageId: string;
  /** Friend who wrote the comment. Routes the trace to /dm/<senderId>. */
  senderId: string;
  /** Friend's nickname for the trace label ("이름 없음" fallback). */
  senderName: string;
  /** True when the comment arrived after the owner last read that DM thread. */
  unread: boolean;
};

export type IncomingInteractionsByTransaction = Map<string, IncomingInteraction>;

// Inverse of getViewerInteractionsByTransaction: returns, for each of the
// OWNER's own transactions, the most recent text comment a FRIEND left on it
// (sender_id <> owner). Drives the incoming-comment trace under each row on
// the owner's own dashboard. Reactions (emoji-only messages) are intentionally
// excluded — the owner-side surface is comments only.
//
// RLS on dm_messages (SELECT = thread member) guarantees this only ever sees
// messages from threads the owner belongs to, so the `sender_id <> ownerId`
// filter is enough to scope it to "comments others wrote on my spending"
// without leaking any other pair's data.
export async function getIncomingInteractionsByTransaction(
  ownerId: string,
  txIds: string[],
): Promise<IncomingInteractionsByTransaction> {
  const result: IncomingInteractionsByTransaction = new Map();
  if (!ownerId || txIds.length === 0) return result;

  const supabase = await createClient();

  const { data: messages, error } = await supabase
    .from("dm_messages")
    .select(
      "id, content, quoted_transaction_id, sender_id, thread_id, created_at",
    )
    .in("quoted_transaction_id", txIds)
    .neq("sender_id", ownerId)
    .order("created_at", { ascending: false })
    // Same hard cap as the viewer-direction query — newest-first ordering
    // means the first text comment we see per tx is the most recent.
    .limit(500);

  if (error || !messages || messages.length === 0) return result;

  type MessageRow = {
    id: string;
    content: string;
    quoted_transaction_id: string | null;
    sender_id: string;
    thread_id: string;
    created_at: string;
  };
  const rows = messages as MessageRow[];

  // Per-thread owner-side last_read_at (to flag unread) and sender nicknames
  // (for the trace label) are independent reads — resolve them in parallel.
  const threadIds = Array.from(new Set(rows.map((m) => m.thread_id)));
  const senderIds = Array.from(new Set(rows.map((m) => m.sender_id)));
  const [threadsRes, profilesRes] = await Promise.all([
    supabase
      .from("dm_threads")
      .select(
        "id, user_a_id, user_b_id, last_read_at_user_a, last_read_at_user_b",
      )
      .in("id", threadIds),
    supabase.from("profiles").select("id, display_name").in("id", senderIds),
  ]);

  const myLastReadByThread = new Map<string, string | null>();
  for (const t of threadsRes.data ?? []) {
    const isUserA = t.user_a_id === ownerId;
    myLastReadByThread.set(
      t.id,
      isUserA ? t.last_read_at_user_a : t.last_read_at_user_b,
    );
  }

  const nameById = new Map<string, string>();
  for (const p of profilesRes.data ?? []) {
    nameById.set(p.id, p.display_name?.trim() || "이름 없음");
  }

  for (const row of rows) {
    const txId = row.quoted_transaction_id;
    if (!txId || result.has(txId)) continue;
    const trimmed = row.content.trim();
    // Comments only — skip emoji-only reactions.
    if (trimmed.length === 0 || EMOJI_ONLY.test(trimmed)) continue;

    const myLastRead = myLastReadByThread.get(row.thread_id) ?? null;
    const unread =
      myLastRead === null ||
      new Date(row.created_at).getTime() > new Date(myLastRead).getTime();

    result.set(txId, {
      lastComment: trimmed,
      lastCommentMessageId: row.id,
      senderId: row.sender_id,
      senderName: nameById.get(row.sender_id) ?? "이름 없음",
      unread,
    });
  }
  return result;
}
