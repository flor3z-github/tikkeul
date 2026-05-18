"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { sendReactionMessageAction } from "@/app/dashboard/interactions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/lib/utils/category-icon";
import { cn } from "@/lib/utils";
import { formatRelativeKoreanDate } from "@/lib/utils/date";
import { formatKRW } from "@/lib/utils/money";

export type InteractionTransaction = {
  id: string;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  spent_at: string;
  memo: string | null;
};

// Curated emoji set. The DM `content` accepts any short string so we can
// extend this without a migration; the UI gates the pick to keep reactions
// visually consistent across friends.
const EMOJI_CHOICES = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: InteractionTransaction;
  /** Transaction owner's user_id. Used by the [답장] button to route the
   *  viewer to /dm/<ownerUserId>?quote=<txId>. The sheet is only mounted for
   *  friend-mode transactions, so this is always a friend's user_id. */
  ownerUserId: string;
};

export function TransactionInteractionSheet({
  open,
  onOpenChange,
  transaction,
  ownerUserId,
}: Props) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={transaction.category_name ?? "기타"}
      subtitle={formatRelativeKoreanDate(new Date(transaction.spent_at))}
      description="친구의 소비에 빠르게 반응하거나 답장할 수 있어요."
    >
      <InteractionBody
        transaction={transaction}
        ownerUserId={ownerUserId}
        onClose={() => onOpenChange(false)}
      />
    </BottomSheet>
  );
}

type BodyProps = {
  transaction: InteractionTransaction;
  ownerUserId: string;
  onClose: () => void;
};

function InteractionBody({ transaction, ownerUserId, onClose }: BodyProps) {
  const router = useRouter();
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleQuickReaction(emoji: string) {
    if (pendingEmoji) return;
    setPendingEmoji(emoji);
    startTransition(async () => {
      const result = await sendReactionMessageAction(transaction.id, emoji);
      setPendingEmoji(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Keep the sheet open so the viewer can chain another reaction or hit
      // the 답장 button without re-opening the row. They dismiss the sheet
      // by tapping outside or swiping down.
      toast.success(
        result.skipped ? "이미 같은 반응을 보냈어요." : "반응을 DM으로 보냈어요.",
      );
    });
  }

  function handleReply() {
    onClose();
    router.push(`/dm/${ownerUserId}?quote=${transaction.id}`);
  }

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
        <p className="text-xs font-medium text-muted-foreground">
          빠른 반응 — DM으로 전송
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {EMOJI_CHOICES.map((emoji) => {
            const pending = pendingEmoji === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => handleQuickReaction(emoji)}
                disabled={pendingEmoji !== null}
                aria-busy={pending}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border text-[18px] transition-all duration-150 ease-out active:scale-[0.96]",
                  "border-border bg-card text-foreground hover:bg-muted",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <span aria-hidden>{emoji}</span>
              </button>
            );
          })}
        </div>
      </section>

      <Button
        type="button"
        onClick={handleReply}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold"
      >
        <MessageCircle className="size-4" aria-hidden />
        답장
      </Button>
    </div>
  );
}
