"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type InteractionActionResult =
  | { ok: true }
  | { ok: false; error: string };

const COMMENT_MAX_LENGTH = 500;
const EMOJI_MAX_LENGTH = 16;

// Toggle a single (transaction, user, emoji) row. If the row exists we delete
// it; otherwise we insert. The caller passes the resolved transactionId — RLS
// fences the underlying read/write to friends-with-show_spending_items or the
// owner, so we don't re-check the friendship here.
export async function toggleReactionAction(
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
  if (
    trimmedEmoji.length === 0 ||
    trimmedEmoji.length > EMOJI_MAX_LENGTH
  ) {
    return { ok: false, error: "사용할 수 없는 이모지예요." };
  }

  const { data: existing, error: selectError } = await supabase
    .from("transaction_reactions")
    .select("transaction_id")
    .eq("transaction_id", transactionId)
    .eq("user_id", user.id)
    .eq("emoji", trimmedEmoji)
    .maybeSingle();
  if (selectError) return { ok: false, error: selectError.message };

  if (existing) {
    const { error } = await supabase
      .from("transaction_reactions")
      .delete()
      .eq("transaction_id", transactionId)
      .eq("user_id", user.id)
      .eq("emoji", trimmedEmoji);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("transaction_reactions").insert({
      transaction_id: transactionId,
      user_id: user.id,
      emoji: trimmedEmoji,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addCommentAction(
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
    return {
      ok: false,
      error: `댓글은 ${COMMENT_MAX_LENGTH}자까지 입력할 수 있어요.`,
    };
  }

  const { error } = await supabase.from("transaction_comments").insert({
    transaction_id: transactionId,
    author_id: user.id,
    content: trimmed,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteCommentAction(
  commentId: string,
): Promise<InteractionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!commentId) return { ok: false, error: "삭제할 댓글이 없어요." };

  // RLS allows DELETE by author or transaction owner; no extra check needed.
  const { error } = await supabase
    .from("transaction_comments")
    .delete()
    .eq("id", commentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
