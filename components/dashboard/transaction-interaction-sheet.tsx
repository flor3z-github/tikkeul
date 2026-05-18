"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Smile, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addCommentAction,
  deleteCommentAction,
  toggleReactionAction,
} from "@/app/dashboard/interactions";
import { BottomSheet, BottomSheetNested } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/lib/utils/category-icon";
import { cn } from "@/lib/utils";
import { formatRelativeKoreanDate } from "@/lib/utils/date";
import { formatKRW } from "@/lib/utils/money";

import {
  TransactionFormDialog,
  type TransactionFormCategory,
  type TransactionFormInitial,
} from "@/components/transactions/transaction-form-dialog";

export type TransactionReactionRow = {
  user_id: string;
  emoji: string;
  created_at: string;
};

export type TransactionCommentRow = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
};

export type InteractionTransaction = {
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

const COMMENT_MAX_LENGTH = 500;

// Curated emoji set. The DB accepts any short string so we can extend this
// without a migration; the UI gates the pick to keep the row look consistent.
const EMOJI_CHOICES = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: InteractionTransaction;
  /** Current viewer's user_id — used to detect "my reaction" / "my comment". */
  viewerId: string;
  /** True when the transaction belongs to the viewer (own dashboard). */
  isOwn: boolean;
  /** display_name lookup for both the owner and all friends in scope. */
  nicknameById: Map<string, string>;
  /** Categories prop forwarded to the nested edit form when own. */
  categories: TransactionFormCategory[];
};

export function TransactionInteractionSheet({
  open,
  onOpenChange,
  transaction,
  viewerId,
  isOwn,
  nicknameById,
  categories,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={transaction.category_name ?? "기타"}
      subtitle={formatRelativeKoreanDate(new Date(transaction.spent_at))}
      description="소비에 반응하거나 댓글을 남길 수 있어요."
    >
      <InteractionBody
        transaction={transaction}
        viewerId={viewerId}
        isOwn={isOwn}
        nicknameById={nicknameById}
        onRequestEdit={() => setEditOpen(true)}
      />
      {isOwn ? (
        // Rendered INSIDE the BottomSheet so vaul registers it as a nested
        // drawer of this one (via `nested`) — parent scales correctly and the
        // iOS keyboard handler runs at the inner level. Do NOT render this as
        // a sibling of BottomSheet; two sibling vaul roots create overlapping
        // overlays and the close animations fight.
        <TransactionFormDialog
          nested
          open={editOpen}
          onOpenChange={setEditOpen}
          categories={categories}
          initial={toFormInitial(transaction)}
          onSaved={() => {
            // After save the parent sheet should close too — the cached
            // transaction row is stale and revalidatePath will replace it on
            // the next render.
            onOpenChange(false);
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

function toFormInitial(tx: InteractionTransaction): TransactionFormInitial {
  return {
    id: tx.id,
    amount: tx.amount,
    category_id: tx.category_id,
    spent_at: tx.spent_at,
    memo: tx.memo,
  };
}

type BodyProps = {
  transaction: InteractionTransaction;
  viewerId: string;
  isOwn: boolean;
  nicknameById: Map<string, string>;
  onRequestEdit: () => void;
};

function InteractionBody({
  transaction,
  viewerId,
  isOwn,
  nicknameById,
  onRequestEdit,
}: BodyProps) {
  const [, startReactionTransition] = useTransition();
  const [commentPending, startCommentTransition] = useTransition();
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [commentText, setCommentText] = useState("");
  const [reactorsOpen, setReactorsOpen] = useState(false);

  // Optimistic reactions: tapping an emoji updates the UI immediately while
  // the server action runs in the background. The reducer mirrors the
  // server's toggle semantics — if the viewer already has the emoji on this
  // row we remove it, otherwise we add a synthetic row. After the action
  // resolves (with revalidatePath) or the realtime refresh lands, React
  // re-renders with the canonical server state and the optimistic delta is
  // discarded.
  const [optimisticReactions, applyOptimisticReaction] = useOptimistic(
    transaction.reactions,
    (current, emoji: string) => {
      const myIndex = current.findIndex(
        (row) => row.user_id === viewerId && row.emoji === emoji,
      );
      if (myIndex >= 0) {
        return current.filter((_, i) => i !== myIndex);
      }
      return [
        ...current,
        {
          user_id: viewerId,
          emoji,
          created_at: new Date().toISOString(),
        },
      ];
    },
  );

  const grouped = useMemo(
    () => groupReactions(optimisticReactions, viewerId),
    [optimisticReactions, viewerId],
  );

  // Emoji-keyed reactor list for the nested "반응" drawer. The top row of
  // the drawer renders one tab per emoji and the bottom shows the nicknames
  // who tapped the currently selected emoji.
  const reactorGroups = useMemo(
    () => groupReactorsByEmoji(optimisticReactions),
    [optimisticReactions],
  );
  const hasAnyReaction = reactorGroups.length > 0;
  const [selectedReactorEmoji, setSelectedReactorEmoji] = useState<
    string | null
  >(null);
  // Clamp to a still-present emoji: optimistic toggles can remove the active
  // tab while the drawer is open, in which case fall back to the first group.
  const activeReactorEmoji =
    selectedReactorEmoji &&
    reactorGroups.some((group) => group.emoji === selectedReactorEmoji)
      ? selectedReactorEmoji
      : (reactorGroups[0]?.emoji ?? null);
  const activeReactorGroup = reactorGroups.find(
    (group) => group.emoji === activeReactorEmoji,
  );

  function handleToggleReaction(emoji: string) {
    // No pending lock — multiple taps queue inside the transition. Server
    // re-evaluates row presence per request, and the final realtime/refresh
    // reconciles any race.
    startReactionTransition(async () => {
      applyOptimisticReaction(emoji);
      const result = await toggleReactionAction(transaction.id, emoji);
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleSubmitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = commentText.trim();
    if (trimmed.length === 0 || commentPending) return;
    startCommentTransition(async () => {
      const result = await addCommentAction(transaction.id, trimmed);
      if (result.ok) {
        setCommentText("");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDeleteComment(commentId: string) {
    if (deletePending) return;
    setDeleteCommentId(commentId);
    startDeleteTransition(async () => {
      const result = await deleteCommentAction(commentId);
      if (!result.ok) toast.error(result.error);
      setDeleteCommentId(null);
    });
  }

  const sortedComments = useMemo(
    () =>
      [...transaction.comments].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      ),
    [transaction.comments],
  );

  return (
    <div className="space-y-5">
      <section className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground">
          <CategoryIcon
            slug={transaction.category_icon}
            className="size-5 text-muted-foreground"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">
            {transaction.category_name ?? "기타"}
          </p>
          {transaction.memo ? (
            <p className="truncate text-[12px] text-muted-foreground">
              {transaction.memo}
            </p>
          ) : null}
        </div>
        <span className="text-[16px] font-bold tabular-nums">
          {formatKRW(transaction.amount)}
        </span>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">반응</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {EMOJI_CHOICES.map((emoji) => {
            const summary = grouped.get(emoji);
            const mine = summary?.byMe ?? false;
            const count = summary?.count ?? 0;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => handleToggleReaction(emoji)}
                aria-pressed={mine}
                className={cn(
                  "flex h-9 items-center gap-1 rounded-full border px-3 text-[14px] transition-all duration-150 ease-out active:scale-[0.96]",
                  mine
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                <span aria-hidden>{emoji}</span>
                {count > 0 ? (
                  <span className="text-[12px] font-semibold tabular-nums">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
          {hasAnyReaction ? (
            <button
              type="button"
              onClick={() => setReactorsOpen(true)}
              aria-label="반응한 사람 보기"
              className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
            >
              <Smile className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </section>

      <BottomSheetNested
        open={reactorsOpen}
        onOpenChange={setReactorsOpen}
        title="반응"
        description="이 소비에 반응한 사람들이에요."
      >
        <div className="space-y-4 pb-2">
          <div
            role="tablist"
            aria-label="이모지 별 반응자"
            className="flex flex-wrap gap-1.5"
          >
            {reactorGroups.map(({ emoji, userIds }) => {
              const active = emoji === activeReactorEmoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedReactorEmoji(emoji)}
                  className={cn(
                    "flex h-9 items-center gap-1 rounded-full border px-3 text-[14px] transition-colors",
                    active
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  <span aria-hidden>{emoji}</span>
                  <span className="text-[12px] font-semibold tabular-nums">
                    {userIds.length}
                  </span>
                </button>
              );
            })}
          </div>
          <ul className="space-y-1">
            {activeReactorGroup?.userIds.map((userId) => {
              const nickname = nicknameById.get(userId) ?? "이름 없음";
              const isMe = userId === viewerId;
              return (
                <li
                  key={userId}
                  className="rounded-xl px-3 py-2 text-[14px]"
                >
                  {isMe ? `${nickname} (나)` : nickname}
                </li>
              );
            })}
          </ul>
        </div>
      </BottomSheetNested>

      <section className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          댓글 {sortedComments.length > 0 ? `(${sortedComments.length})` : null}
        </p>
        {sortedComments.length === 0 ? (
          <p className="rounded-2xl bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
            아직 댓글이 없어요. 처음 남겨보세요.
          </p>
        ) : (
          <ul className="space-y-2">
            {sortedComments.map((comment) => {
              const isAuthor = comment.author_id === viewerId;
              const canDelete = isAuthor || isOwn;
              const isDeleting =
                deletePending && deleteCommentId === comment.id;
              const nickname =
                nicknameById.get(comment.author_id) ?? "이름 없음";
              return (
                <li
                  key={comment.id}
                  className="rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-semibold">
                      {isAuthor ? `${nickname} (나)` : nickname}
                    </p>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {formatRelativeKoreanDate(new Date(comment.created_at))}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-snug">
                    {comment.content}
                  </p>
                  {canDelete ? (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        aria-label="댓글 삭제"
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={isDeleting || deletePending}
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        <Trash2 className="size-3" />
                        {isDeleting ? "삭제 중…" : "삭제"}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <form
          onSubmit={handleSubmitComment}
          className="flex items-end gap-2 pt-1"
        >
          <textarea
            value={commentText}
            onChange={(event) =>
              setCommentText(event.target.value.slice(0, COMMENT_MAX_LENGTH))
            }
            maxLength={COMMENT_MAX_LENGTH}
            placeholder="댓글 남기기"
            rows={1}
            className="min-h-12 flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[14px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40 focus:bg-background"
          />
          <Button
            type="submit"
            disabled={commentText.trim().length === 0 || commentPending}
            className="h-12 rounded-full px-4 text-[14px] font-semibold"
          >
            {commentPending ? "전송 중…" : "전송"}
          </Button>
        </form>
      </section>

      {isOwn ? (
        <Button
          type="button"
          variant="outline"
          onClick={onRequestEdit}
          className="h-12 w-full rounded-full text-[15px] font-semibold"
        >
          소비 수정
        </Button>
      ) : null}
    </div>
  );
}

function groupReactions(rows: TransactionReactionRow[], viewerId: string) {
  const grouped = new Map<string, { count: number; byMe: boolean }>();
  for (const row of rows) {
    const current = grouped.get(row.emoji) ?? { count: 0, byMe: false };
    current.count += 1;
    if (row.user_id === viewerId) current.byMe = true;
    grouped.set(row.emoji, current);
  }
  return grouped;
}

// Emoji-keyed grouping for the reactor drawer's tab row. Sort: reactor count
// desc, then emoji asc for stable ordering across re-renders. user_ids
// preserve input order (query returns reactions sorted ascending by
// created_at).
function groupReactorsByEmoji(rows: TransactionReactionRow[]) {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.emoji) ?? [];
    list.push(row.user_id);
    map.set(row.emoji, list);
  }
  return Array.from(map.entries())
    .map(([emoji, userIds]) => ({ emoji, userIds }))
    .sort(
      (a, b) =>
        b.userIds.length - a.userIds.length || a.emoji.localeCompare(b.emoji),
    );
}
