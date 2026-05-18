"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";

import {
  TransactionInteractionSheet,
  type InteractionTransaction,
  type TransactionCommentRow,
  type TransactionReactionRow,
} from "@/components/dashboard/transaction-interaction-sheet";
import { CategoryIcon } from "@/lib/utils/category-icon";
import { formatKRW } from "@/lib/utils/money";

import type { TransactionFormCategory } from "./transaction-form-dialog";

export type TransactionListRow = {
  id: string;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  spent_at: string;
  memo: string | null;
  reactions: TransactionReactionRow[];
  comments: TransactionCommentRow[];
};

type TransactionItemProps = {
  transaction: TransactionListRow;
  categories: TransactionFormCategory[];
  /** Current viewer's user_id. Used by the interaction sheet for ownership UI. */
  viewerId: string;
  /** True when the transaction belongs to the viewer (own dashboard). */
  isOwn: boolean;
  /** display_name lookup for all users in scope (owner + friends). */
  nicknameById: Map<string, string>;
};

const ROW_CLASS =
  "block w-full rounded-2xl px-3 py-2 text-left motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200";

export function TransactionItem({
  transaction,
  categories,
  viewerId,
  isOwn,
  nicknameById,
}: TransactionItemProps) {
  const [open, setOpen] = useState(false);

  // Pre-grouped reaction summary for the inline badge — same shape as the
  // sheet uses, computed once at the row level so we don't render dozens of
  // empty maps in dense days.
  const reactionPreview = useMemo(
    () => previewReactions(transaction.reactions),
    [transaction.reactions],
  );

  const commentCount = transaction.comments.length;
  // Comments arrive sorted ascending by created_at from the query, so the
  // last element is the most recent. We surface it inline so the row doubles
  // as a conversation preview without forcing the user to open the sheet.
  const latestComment =
    commentCount > 0 ? transaction.comments[commentCount - 1] : null;
  const latestCommentNickname = latestComment
    ? (nicknameById.get(latestComment.author_id) ?? "이름 없음")
    : null;
  const hasFooter = reactionPreview.length > 0 || commentCount > 0;

  const interactionTransaction: InteractionTransaction = {
    id: transaction.id,
    amount: Number(transaction.amount),
    category_id: transaction.category_id,
    category_name: transaction.category_name,
    category_icon: transaction.category_icon,
    spent_at: transaction.spent_at,
    memo: transaction.memo,
    reactions: transaction.reactions,
    comments: transaction.comments,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${ROW_CLASS} transition-colors hover:bg-muted active:bg-muted`}
      >
        <div className="flex w-full items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <CategoryIcon
              slug={transaction.category_icon}
              className="size-5 text-muted-foreground"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">
              {transaction.category_name ?? "기타"}
            </p>
            {transaction.memo ? (
              <p className="truncate text-[12px] text-muted-foreground">
                {transaction.memo}
              </p>
            ) : null}
          </div>
          <span className="text-[15px] font-semibold tabular-nums">
            {formatKRW(Number(transaction.amount))}
          </span>
        </div>

        {hasFooter ? (
          <div className="mt-1 space-y-1 pl-[52px]">
            {reactionPreview.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {reactionPreview.map(({ emoji, count }) => (
                  <span
                    key={emoji}
                    className="flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[11px]"
                  >
                    <span aria-hidden>{emoji}</span>
                    <span className="font-semibold tabular-nums">{count}</span>
                  </span>
                ))}
              </div>
            ) : null}
            {latestComment && latestCommentNickname ? (
              <div className="flex min-w-0 items-start gap-1 text-[12px] text-muted-foreground">
                <MessageCircle
                  className="mt-[3px] size-3 shrink-0"
                  aria-hidden
                />
                <p className="min-w-0 flex-1 truncate">
                  <span className="font-semibold text-foreground">
                    {latestCommentNickname}
                  </span>
                  <span className="mx-1">·</span>
                  <span>{latestComment.content}</span>
                  {commentCount > 1 ? (
                    <span className="ml-1.5 text-[11px] tabular-nums opacity-60">
                      +{commentCount - 1}
                    </span>
                  ) : null}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </button>

      <TransactionInteractionSheet
        open={open}
        onOpenChange={setOpen}
        transaction={interactionTransaction}
        viewerId={viewerId}
        isOwn={isOwn}
        nicknameById={nicknameById}
        categories={categories}
      />
    </>
  );
}

function previewReactions(rows: TransactionReactionRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.emoji, (counts.get(row.emoji) ?? 0) + 1);
  }
  // Sort by count desc, then by emoji for stable order.
  return Array.from(counts.entries())
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}
