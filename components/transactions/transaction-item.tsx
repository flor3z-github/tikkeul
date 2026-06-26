"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Heart,
  Lock,
  MessageCircle,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  markIncomingCommentReadAction,
  sendCommentMessageAction,
  sendReactionMessageAction,
} from "@/app/dashboard/interactions";
import type { InteractionMode } from "@/components/dashboard/calendar-day-panel";
import { Button } from "@/components/ui/button";
import {
  TransactionFormDialog,
  type TransactionFormCategory,
  type TransactionFormGroup,
  type TransactionFormInitial,
} from "@/components/transactions/transaction-form-dialog";
import { CategoryIcon } from "@/lib/utils/category-icon";
import { cn } from "@/lib/utils";
import { formatKRW } from "@/lib/utils/money";
import type { TransactionVisibility } from "@/lib/queries/transactions";

export type TransactionListRow = {
  id: string;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  spent_at: string;
  memo: string | null;
  visibility: TransactionVisibility;
  visible_group_ids: string[];
};

// Curated quick-reaction set — matches the legacy interaction sheet so
// existing reactions stay visually consistent across the app.
const EMOJI_CHOICES = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
const COMMENT_MAX_LENGTH = 500;

type TransactionItemProps = {
  transaction: TransactionListRow;
  categories: TransactionFormCategory[];
  /** Owner's friend groups (seed + user-defined), forwarded to the edit
   *  form so the visibility selector can render. Empty in friend view
   *  (no edit affordance). */
  groups?: TransactionFormGroup[];
  /** True when the transaction belongs to the viewer (own dashboard). Tap
   *  opens the edit form directly; the friend interaction panel is skipped. */
  isOwn: boolean;
  ownerUserId: string;
  /** Own mode: most recent text comment a friend left on this transaction.
   *  Renders a tappable trace under the summary: tapping the text expands the
   *  full comment inline (truncate↔full), while a separate [↗] button deep-links
   *  to the DM message. Null when no friend has commented. */
  incomingComment?: string | null;
  /** Own mode: dm_messages.id for incomingComment — /dm/<sender>?message=<id>. */
  incomingCommentMessageId?: string | null;
  /** Own mode: friend who wrote incomingComment — routes the trace to their DM. */
  incomingCommentSenderId?: string | null;
  /** Own mode: that friend's nickname, shown before the comment text. */
  incomingCommentSenderName?: string | null;
  /** Own mode: true when incomingComment is unread (accents the trace). */
  incomingCommentUnread?: boolean;
  /** Friend mode: viewer's last emoji-only DM reaction on this transaction.
   *  Renders in place of the empty heart so the viewer sees their own state. */
  lastEmoji?: string | null;
  /** Friend mode: viewer's most recent text comment. Tappable trace beside the
   *  message icon — tapping expands the full text in a block below the row so
   *  the viewer can re-read what they wrote. */
  lastComment?: string | null;
  /** Friend mode: dm_messages.id for the message that produced lastComment.
   *  Tapping the pill expands an inline below-row block; the "전체 대화 보기" link
   *  in that block deep-links to /dm/<owner>?message=<id>. When this is set the
   *  row is treated as "comment locked" — the inline comment form does not
   *  render, so the DM thread stays the single source of truth. */
  lastCommentMessageId?: string | null;
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
  groups,
  isOwn,
  ownerUserId,
  incomingComment,
  incomingCommentMessageId,
  incomingCommentSenderId,
  incomingCommentSenderName,
  incomingCommentUnread,
  lastEmoji,
  lastComment,
  lastCommentMessageId,
  isActive,
  activeMode,
  commentDraft,
  onCommentDraftChange,
  onSelectMode,
  onCommitClose,
}: TransactionItemProps) {
  if (isOwn) {
    return (
      <OwnRow
        transaction={transaction}
        categories={categories}
        groups={groups ?? []}
        incomingComment={incomingComment ?? null}
        incomingCommentMessageId={incomingCommentMessageId ?? null}
        incomingCommentSenderId={incomingCommentSenderId ?? null}
        incomingCommentSenderName={incomingCommentSenderName ?? null}
        incomingCommentUnread={incomingCommentUnread ?? false}
      />
    );
  }

  return (
    <FriendRow
      transaction={transaction}
      lastEmoji={lastEmoji ?? null}
      lastComment={lastComment ?? null}
      lastCommentMessageId={lastCommentMessageId ?? null}
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
  groups,
  incomingComment,
  incomingCommentMessageId,
  incomingCommentSenderId,
  incomingCommentSenderName,
  incomingCommentUnread,
}: {
  transaction: TransactionListRow;
  categories: TransactionFormCategory[];
  groups: TransactionFormGroup[];
  incomingComment: string | null;
  incomingCommentMessageId: string | null;
  incomingCommentSenderId: string | null;
  incomingCommentSenderName: string | null;
  incomingCommentUnread: boolean;
}) {
  const [open, setOpen] = useState(false);
  // A friend left a comment on this transaction. Render a trace under the
  // summary; tapping it expands the full text inline. All three ids must be
  // present to build the DM deep-link; otherwise fall back to the plain row.
  const hasIncoming = Boolean(
    incomingComment && incomingCommentMessageId && incomingCommentSenderId,
  );

  return (
    <div className="rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "block w-full rounded-2xl px-3 text-left transition-colors hover:bg-muted active:bg-muted motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
          hasIncoming ? "pt-2 pb-1" : "py-2",
        )}
      >
        <TransactionSummary transaction={transaction} />
      </button>
      {incomingComment && incomingCommentMessageId && incomingCommentSenderId ? (
        // Keyed by the message id so a newer comment (which replaces this one as
        // the most-recent trace under a soft router.refresh that keeps this row
        // mounted) remounts the trace fresh — resetting expanded/readLocally so
        // the new, genuinely-unread comment shows its dot and renders collapsed.
        <IncomingCommentTrace
          key={incomingCommentMessageId}
          comment={incomingComment}
          messageId={incomingCommentMessageId}
          senderId={incomingCommentSenderId}
          senderName={incomingCommentSenderName ?? "이름 없음"}
          unread={incomingCommentUnread}
        />
      ) : null}
      <TransactionFormDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        groups={groups}
        initial={toFormInitial(transaction)}
        onSaved={() => setOpen(false)}
      />
    </div>
  );
}

// Friend's comment trace on the owner's own transaction. Tapping the text
// expands the full comment inline (truncate↔full) and, if unread, marks the DM
// thread read (optimistic row-dot clear + router.refresh for the server-
// computed header dot). The [↗] stays a separate, always-visible deep-link to
// the DM thread. Mounted keyed by messageId (see OwnRow) so it resets cleanly
// when a newer comment replaces this one.
function IncomingCommentTrace({
  comment,
  messageId,
  senderId,
  senderName,
  unread,
}: {
  comment: string;
  messageId: string;
  senderId: string;
  senderName: string;
  unread: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [readLocally, setReadLocally] = useState(false);
  const [, startReadTransition] = useTransition();
  const showUnread = unread && !readLocally;

  function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    // Expanding to read clears unread (thread-unit, same as a DM visit). Only
    // fire on expand, only when actually unread, and only once.
    if (next && unread && !readLocally) {
      setReadLocally(true);
      startReadTransition(async () => {
        const result = await markIncomingCommentReadAction(messageId);
        if (result.ok) {
          router.refresh();
        } else {
          // Roll back the optimistic clear + surface the error (file convention)
          // so a later expand can retry.
          setReadLocally(false);
          toast.error(result.error);
        }
      });
    }
  }

  return (
    <div className="mx-3 mb-1.5 flex items-start gap-1">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`${senderName}님의 댓글: ${comment}`}
        className={cn(
          "flex min-w-0 flex-1 items-start gap-1.5 rounded-2xl px-2 py-1 text-left text-[12px] transition-colors hover:bg-muted",
          showUnread ? "text-primary" : "text-muted-foreground",
        )}
      >
        <MessageCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {showUnread ? (
          <span
            aria-hidden
            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
          />
        ) : null}
        <span className="shrink-0 font-medium">{senderName}</span>
        <span aria-hidden className="shrink-0 text-muted-foreground/50">
          ·
        </span>
        <span
          className={cn(
            "min-w-0 flex-1",
            expanded ? "whitespace-pre-wrap break-words" : "truncate",
          )}
        >
          {comment}
        </span>
      </button>
      <a
        href={`/dm/${senderId}?message=${messageId}`}
        aria-label={`${senderName}님과의 DM에서 보기`}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowUpRight className="size-3.5" aria-hidden />
      </a>
    </div>
  );
}

// --- Friend mode --------------------------------------------------------

type FriendRowProps = {
  transaction: TransactionListRow;
  lastEmoji: string | null;
  lastComment: string | null;
  lastCommentMessageId: string | null;
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
  lastComment,
  lastCommentMessageId,
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
  // Inline expand of the viewer's own locked comment trace. The pill stays
  // compact in the icon row (space-constrained beside the emoji button); the
  // full text renders in a block below the row when toggled open.
  const [expanded, setExpanded] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // A row is "comment-locked" once the viewer has sent a text comment on it —
  // the message-icon turns into a deep link to that DM message and the inline
  // comment form is suppressed (the DM thread is the only place to edit).
  // In that state, tapping the row body falls back to opening the emoji panel
  // because the comment surface no longer accepts input.
  const hasComment = Boolean(lastComment && lastCommentMessageId);

  function handleRowClick() {
    if (!isActive) {
      onSelectMode?.(transaction.id, hasComment ? "emoji" : "comment");
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
      // Refresh the server tree so the message icon flips from input-toggle
      // to a deep-link anchor on the next render — the comment is now locked.
      router.refresh();
    });
  }

  // The comment textarea mounts inline in the middle of the dashboard scroll
  // body and is autoFocused the moment the panel expands. On iOS the focus
  // event that autoFocus fires during that layout change does NOT trigger the
  // native "scroll focused input into view" (a later manual tap on the same,
  // now-settled, input does — confirmed on device), so the soft keyboard rises
  // and covers the textarea. We scroll it into view ourselves — once, smoothly,
  // and only after the reveal animation (200ms) and the keyboard rise (~300ms)
  // have settled. Firing earlier or twice fights the keyboard's own animation
  // and reads as a hard jump; a single delayed glide lands it cleanly.
  function handleCommentFocus() {
    setTimeout(() => {
      commentInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 350);
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
        {hasComment ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-expanded={expanded}
            aria-label={`댓글: ${lastComment}`}
            className="inline-flex h-8 min-w-0 max-w-[60%] items-center gap-1.5 rounded-full px-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <MessageCircle className="size-4 shrink-0" aria-hidden />
            {/* When expanded, the full text shows in the block below — drop the
                pill's truncated preview so the comment isn't rendered twice; the
                icon alone stays as the collapse handle. */}
            {expanded ? null : (
              <>
                <span
                  aria-hidden
                  className="text-[12px] text-muted-foreground/60"
                >
                  ·
                </span>
                <span className="truncate text-[12px]">{lastComment}</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            aria-label="댓글 달기"
            aria-pressed={isActive && activeMode === "comment"}
            onClick={(event) => {
              event.stopPropagation();
              onSelectMode?.(transaction.id, "comment");
            }}
            className={cn(
              "inline-flex h-8 min-w-0 max-w-[60%] items-center gap-1.5 rounded-full px-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground",
              isActive && activeMode === "comment" && "bg-card text-foreground",
            )}
          >
            <MessageCircle className="size-4 shrink-0" aria-hidden />
          </button>
        )}
      </div>

      {hasComment && expanded ? (
        // Below-row reveal of the full comment. Uses the emoji panel's
        // opacity/transform animation (fade-in + slide-in-from-top), NOT the
        // comment form's grid 0fr→1fr reveal — height/grid reveals are
        // GPU-composite-bound and stutter on iOS.
        <div className="px-3 pb-3 pt-0.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150">
          <p className="whitespace-pre-wrap break-words rounded-2xl bg-card px-3 py-2 text-[13px] text-foreground">
            {lastComment}
          </p>
          <a
            href={`/dm/${ownerUserId}?message=${lastCommentMessageId}`}
            onClick={(event) => event.stopPropagation()}
            className="mt-1 inline-flex items-center py-2 text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            전체 대화 보기
          </a>
        </div>
      ) : null}

      {isActive && activeMode === "emoji" ? (
        <div className="px-3 pb-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150">
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
        </div>
      ) : null}

      {isActive && activeMode === "comment" && !hasComment ? (
        // grid + grid-rows-[1fr] with an overflow-hidden child is the height
        // animation target; motion-safe:animate-comment-reveal plays the
        // 0fr→1fr grow on mount. Under reduced motion the resting 1fr applies
        // instantly. The <form> keeps autoFocus so iOS still raises the
        // keyboard from the tap that opened the panel.
        <div className="grid grid-rows-[1fr] motion-safe:animate-comment-reveal">
          <form
            onSubmit={handleCommentSubmit}
            onClick={(event) => event.stopPropagation()}
            className="space-y-2 overflow-hidden px-3 pb-3 pt-0.5"
          >
          <textarea
            ref={commentInputRef}
            value={commentDraft}
            onChange={(event) =>
              onCommentDraftChange?.(
                event.target.value.slice(0, COMMENT_MAX_LENGTH),
              )
            }
            onFocus={handleCommentFocus}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder="이 소비에 댓글 달기"
            rows={2}
            autoFocus
            className="w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40"
          />
          <div className="flex items-center justify-between gap-2">
            <a
              href={`/dm/${ownerUserId}?quote=${transaction.id}`}
              className="inline-flex items-center py-2 text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
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
        </div>
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
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          !transaction.category_color && "bg-muted text-muted-foreground",
        )}
        style={
          transaction.category_color
            ? {
                backgroundColor: `${transaction.category_color}26`,
                color: transaction.category_color,
              }
            : undefined
        }
      >
        <CategoryIcon slug={transaction.category_icon} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[15px] font-medium">
          <span className="truncate">
            {transaction.category_name ?? "기타"}
          </span>
          {transaction.visibility === "private" ? (
            <Lock
              className="size-3 shrink-0 text-muted-foreground"
              aria-label="비공개"
            />
          ) : transaction.visibility === "groups" ? (
            <Users
              className="size-3 shrink-0 text-muted-foreground"
              aria-label="친한 친구 공개"
            />
          ) : null}
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
    visibility: tx.visibility,
    visible_group_ids: tx.visible_group_ids,
  };
}
