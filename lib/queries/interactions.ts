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
  // RLS scopes dm_messages to thread members, so an unauthorized request
  // returns an empty array rather than leaking another pair's data.
  const { data, error } = await supabase
    .from("dm_messages")
    .select("id, content, quoted_transaction_id, created_at")
    .eq("sender_id", viewerId)
    .not("quoted_transaction_id", "is", null)
    .order("created_at", { ascending: false })
    // Hard cap so an active thread doesn't pull thousands of rows just to
    // populate per-transaction state. Newest-first ordering means we naturally
    // see the latest emoji/comment per tx first.
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
