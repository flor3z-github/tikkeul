"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

import {
  sendCommentMessageAction,
  sendReactionMessageAction,
} from "@/app/dashboard/interactions";
import type { InteractionMode } from "@/components/dashboard/calendar-day-panel";
import { Button } from "@/components/ui/button";
import {
  TransactionFormDialog,
  type TransactionFormCategory,
  type TransactionFormInitial,
} from "@/components/transactions/transaction-form-dialog";
import { CategoryIcon } from "@/lib/utils/category-icon";
import { cn } from "@/lib/utils";
import { formatKRW } from "@/lib/utils/money";

export type TransactionListRow = {
  id: string;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  spent_at: string;
  memo: string | null;
};

// Curated quick-reaction set — matches the legacy interaction sheet so
// existing reactions stay visually consistent across the app.
const EMOJI_CHOICES = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
const COMMENT_MAX_LENGTH = 500;

type TransactionItemProps = {
  transaction: TransactionListRow;
  categories: TransactionFormCategory[];
  /** True when the transaction belongs to the viewer (own dashboard). Tap
   *  opens the edit form directly; the friend interaction panel is skipped. */
  isOwn: boolean;
  ownerUserId: string;
  /** Friend mode: viewer's last emoji-only DM reaction on this transaction.
   *  Renders in place of the empty heart so the viewer sees their own state. */
  lastEmoji?: string | null;
  /** Friend mode parent-managed exclusive state. */
  isActive?: boolean;
  activeMode?: InteractionMode | null;
  /** Controlled comment draft. Parent owns it so it can decide whether
   *  outside-click should close the panel immediately or trigger a
   *  discard-confirm AlertDialog. */
  commentDraft?: string;
  onCommentDraftChange?: (next: string) => void;
  onSelectMode?: (rowId: string, mode: InteractionMode) => void;
  onCommitClose?: () => void;
};

export function TransactionItem({
  transaction,
  categories,
  isOwn,
  ownerUserId,
  lastEmoji,
  isActive,
  activeMode,
  commentDraft,
  onCommentDraftChange,
  onSelectMode,
  onCommitClose,
}: TransactionItemProps) {
  if (isOwn) {
    return <OwnRow transaction={transaction} categories={categories} />;
  }

  return (
    <FriendRow
      transaction={transaction}
      lastEmoji={lastEmoji ?? null}
      ownerUserId={ownerUserId}
      isActive={isActive ?? false}
      activeMode={activeMode ?? null}
      commentDraft={commentDraft ?? ""}
      onCommentDraftChange={onCommentDraftChange}
      onSelectMode={onSelectMode}
      onCommitClose={onCommitClose}
    />
  );
}

// --- Own mode -----------------------------------------------------------

function OwnRow({
  transaction,
  categories,
}: {
  transaction: TransactionListRow;
  categories: TransactionFormCategory[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full rounded-2xl px-3 py-2 text-left transition-colors hover:bg-muted active:bg-muted motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      >
        <TransactionSummary transaction={transaction} />
      </button>
      <TransactionFormDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        initial={toFormInitial(transaction)}
        onSaved={() => setOpen(false)}
      />
    </>
  );
}

// --- Friend mode --------------------------------------------------------

type FriendRowProps = {
  transaction: TransactionListRow;
  lastEmoji: string | null;
  ownerUserId: string;
  isActive: boolean;
  activeMode: InteractionMode | null;
  commentDraft: string;
  onCommentDraftChange?: (next: string) => void;
  onSelectMode?: (rowId: string, mode: InteractionMode) => void;
  onCommitClose?: () => void;
};

function FriendRow({
  transaction,
  lastEmoji,
  ownerUserId,
  isActive,
  activeMode,
  commentDraft,
  onCommentDraftChange,
  onSelectMode,
  onCommitClose,
}: FriendRowProps) {
  const router = useRouter();
  const [reactionPending, startReactionTransition] = useTransition();
  const [commentPending, startCommentTransition] = useTransition();

  function handleRowClick() {
    if (!isActive) {
      onSelectMode?.(transaction.id, "comment");
    }
  }

  function handleEmojiPick(emoji: string) {
    if (reactionPending) return;
    startReactionTransition(async () => {
      const result = await sendReactionMessageAction(transaction.id, emoji);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.removed) {
        toast.success("반응을 취소했어요.");
      } else if (result.skipped) {
        toast.success("이미 같은 반응을 보냈어요.");
      } else {
        toast.success("반응을 DM으로 보냈어요.");
      }
      // revalidatePath('/dashboard') refreshes the server-rendered tree on
      // next navigation; router.refresh() forces an immediate re-fetch so
      // the heart icon updates in place after a toggle.
      router.refresh();
      onCommitClose?.();
    });
  }

  function handleCommentSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = commentDraft.trim();
    if (trimmed.length === 0 || commentPending) return;
    startCommentTransition(async () => {
      const result = await sendCommentMessageAction(transaction.id, trimmed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("댓글을 DM으로 보냈어요.");
      onCommentDraftChange?.("");
      onCommitClose?.();
    });
  }

  const heartLabel = lastEmoji ?? null;

  return (
    <div
      className={cn(
        "rounded-2xl transition-colors",
        isActive ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      <button
        type="button"
        onClick={handleRowClick}
        aria-expanded={isActive}
        className="block w-full rounded-2xl px-3 pt-2 pb-1 text-left motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      >
        <TransactionSummary transaction={transaction} />
      </button>

      <div className="flex items-center gap-1 px-3 pb-2 pt-0.5">
        <button
          type="button"
          aria-label={heartLabel ? "반응 변경" : "이모지 반응"}
          aria-pressed={isActive && activeMode === "emoji"}
          onClick={(event) => {
            event.stopPropagation();
            onSelectMode?.(transaction.id, "emoji");
          }}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground",
            isActive && activeMode === "emoji" && "bg-card text-foreground",
          )}
        >
          {heartLabel ? (
            <span aria-hidden className="text-[18px] leading-none">
              {heartLabel}
            </span>
          ) : (
            <Heart className="size-4" aria-hidden />
          )}
        </button>
        <button
          type="button"
          aria-label="댓글 달기"
          aria-pressed={isActive && activeMode === "comment"}
          onClick={(event) => {
            event.stopPropagation();
            onSelectMode?.(transaction.id, "comment");
          }}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground",
            isActive && activeMode === "comment" && "bg-card text-foreground",
          )}
        >
          <MessageCircle className="size-4" aria-hidden />
        </button>
      </div>

      {isActive && activeMode === "emoji" ? (
        <div className="px-3 pb-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            빠른 반응 — DM으로 전송
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {EMOJI_CHOICES.map((emoji) => {
              const isCurrent = lastEmoji === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleEmojiPick(emoji);
                  }}
                  disabled={reactionPending}
                  aria-label={
                    isCurrent ? `${emoji} 반응 취소` : `${emoji} 반응 보내기`
                  }
                  aria-pressed={isCurrent}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border text-[18px] transition-all duration-150 ease-out active:scale-[0.96]",
                    "border-border bg-card text-foreground hover:bg-muted",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    isCurrent &&
                      "border-primary bg-primary/10 ring-2 ring-primary/30",
                  )}
                >
                  <span aria-hidden>{emoji}</span>
                </button>
              );
            })}
          </div>
          {lastEmoji ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              현재 반응 {lastEmoji} · 같은 이모지를 다시 누르면 취소돼요.
            </p>
          ) : null}
        </div>
      ) : null}

      {isActive && activeMode === "comment" ? (
        <form
          onSubmit={handleCommentSubmit}
          onClick={(event) => event.stopPropagation()}
          className="space-y-2 px-3 pb-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150"
        >
          <textarea
            value={commentDraft}
            onChange={(event) =>
              onCommentDraftChange?.(
                event.target.value.slice(0, COMMENT_MAX_LENGTH),
              )
            }
            maxLength={COMMENT_MAX_LENGTH}
            placeholder="이 소비에 댓글 달기"
            rows={2}
            autoFocus
            className="w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40"
          />
          <div className="flex items-center justify-between gap-2">
            <a
              href={`/dm/${ownerUserId}?quote=${transaction.id}`}
              className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              전체 대화 보기
            </a>
            <Button
              type="submit"
              size="sm"
              disabled={commentDraft.trim().length === 0 || commentPending}
              className="h-9 gap-1.5 rounded-full px-3 text-[13px]"
            >
              <Send className="size-3.5" aria-hidden />
              {commentPending ? "전송 중…" : "전송"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

// --- Shared row summary -------------------------------------------------

function TransactionSummary({
  transaction,
}: {
  transaction: TransactionListRow;
}) {
  return (
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
  );
}

function toFormInitial(tx: TransactionListRow): TransactionFormInitial {
  return {
    id: tx.id,
    amount: tx.amount,
    category_id: tx.category_id,
    spent_at: tx.spent_at,
    memo: tx.memo,
  };
}
