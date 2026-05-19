import { createClient } from "@/lib/supabase/server";

// Matches strings made up purely of emoji codepoints (plus the variation
// selectors and zero-width joiners that compose multi-codepoint emoji). Used
// to decide which DM messages render as "reactions" rather than text.
const EMOJI_ONLY = /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+$/u;

export type LastEmojiByTransaction = Map<string, string>;

// Returns, for each of the friend's transactions, the most recent emoji-only
// DM message the viewer has sent that quotes that transaction. The result
// drives the heart-icon state in the friend-mode transaction list: when the
// map has an entry for a transaction, that emoji is rendered in place of the
// empty heart so the viewer sees their own last reaction.
//
// We do this with a single batched read of the viewer→owner DM thread's
// quoted messages and group them in JS. There is no SQL-side emoji predicate
// (regex on content) — that's filtered in JS to keep the query plan trivial.
export async function getLastEmojiByTransaction(
  viewerId: string,
  ownerId: string,
): Promise<LastEmojiByTransaction> {
  const result: LastEmojiByTransaction = new Map();
  if (!viewerId || !ownerId || viewerId === ownerId) return result;

  const supabase = await createClient();
  // RLS scopes dm_messages to thread members, so an unauthorized request
  // returns an empty array rather than leaking another pair's data.
  const { data, error } = await supabase
    .from("dm_messages")
    .select("content, quoted_transaction_id, created_at")
    .eq("sender_id", viewerId)
    .not("quoted_transaction_id", "is", null)
    .order("created_at", { ascending: false })
    // Hard cap so an active thread doesn't pull thousands of comments just to
    // resolve the heart icon. The most-recent N covers the dashboard window
    // since the friend list is per-cycle (≤ ~100 transactions).
    .limit(500);

  if (error || !data) return result;

  // First match wins per transaction id because we already sorted desc.
  for (const row of data as Array<{
    content: string;
    quoted_transaction_id: string | null;
  }>) {
    const txId = row.quoted_transaction_id;
    if (!txId || result.has(txId)) continue;
    const trimmed = row.content.trim();
    if (trimmed.length === 0) continue;
    if (!EMOJI_ONLY.test(trimmed)) continue;
    result.set(txId, trimmed);
  }
  return result;
}
