"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { CategoryIcon } from "@/lib/utils/category-icon";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  formatChatDateSeparator,
  formatChatTime,
  toISODate,
} from "@/lib/utils/date";
import { formatKRW } from "@/lib/utils/money";

import { deleteMessageAction, sendMessageAction } from "../actions";

const MESSAGE_MAX_LENGTH = 500;
// Same-sender messages sent within this many milliseconds of each other are
// rendered as a single visual group (shared time stamp, tight vertical spacing,
// nickname only on the first row). One minute matches KakaoTalk's default.
const GROUP_GAP_MS = 60_000;
const LONG_PRESS_MS = 500;

export type DmChatQuoteCard = {
  id: string;
  amount: number;
  spent_at: string;
  memo: string | null;
  deleted: boolean;
  category_name: string | null;
  category_icon: string | null;
};

export type DmChatMessage = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  quote: DmChatQuoteCard | null;
};

type MessageGroup = {
  kind: "group";
  senderId: string;
  isMe: boolean;
  messages: DmChatMessage[];
};
type DateSeparator = { kind: "date"; key: string; label: string };
type RenderItem = MessageGroup | DateSeparator;

type Props = {
  threadId: string;
  viewerId: string;
  friendId: string;
  friendNickname: string;
  initialMessages: DmChatMessage[];
  prefilledQuote: DmChatQuoteCard | null;
};

function buildRenderItems(
  messages: DmChatMessage[],
  viewerId: string,
): RenderItem[] {
  const items: RenderItem[] = [];
  let currentGroup: MessageGroup | null = null;
  let lastDateKey: string | null = null;

  const flushGroup = () => {
    if (currentGroup) {
      items.push(currentGroup);
      currentGroup = null;
    }
  };

  for (const message of messages) {
    const messageDate = new Date(message.createdAt);
    const dateKey = toISODate(messageDate);

    if (dateKey !== lastDateKey) {
      flushGroup();
      items.push({
        kind: "date",
        key: dateKey,
        label: formatChatDateSeparator(messageDate),
      });
      lastDateKey = dateKey;
    }

    const continuesGroup =
      currentGroup !== null &&
      currentGroup.senderId === message.senderId &&
      // Quoted messages start their own group so the quote card always sits at
      // the visual top of the bubble cluster instead of being orphaned.
      message.quote === null &&
      messageDate.getTime() -
        new Date(
          currentGroup.messages[currentGroup.messages.length - 1].createdAt,
        ).getTime() <=
        GROUP_GAP_MS;

    if (continuesGroup && currentGroup) {
      currentGroup.messages.push(message);
    } else {
      flushGroup();
      currentGroup = {
        kind: "group",
        senderId: message.senderId,
        isMe: message.senderId === viewerId,
        messages: [message],
      };
    }
  }
  flushGroup();
  return items;
}

export function DmChat({
  threadId,
  viewerId,
  friendNickname,
  initialMessages,
  prefilledQuote,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [pendingQuote, setPendingQuote] = useState<DmChatQuoteCard | null>(
    prefilledQuote,
  );
  const [sendPending, startSendTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const renderItems = useMemo(
    () => buildRenderItems(initialMessages, viewerId),
    [initialMessages, viewerId],
  );

  // Realtime subscription: any insert/update/delete on this thread triggers
  // a debounced server-component refresh. RLS already restricts the channel
  // to thread members. Three hundred ms matches the dashboard watcher.
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };

    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) {
        await supabase.realtime.setAuth(accessToken);
      }
      if (cancelled) return;
      channel = supabase
        .channel(`dm-thread:${threadId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "dm_messages",
            filter: `thread_id=eq.${threadId}`,
          },
          schedule,
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [threadId, router]);

  // Auto-scroll to the latest message whenever the list grows. We do this on
  // initialMessages identity changes (router.refresh swaps the array) rather
  // than tracking length so a reload after delete also re-anchors at the end.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "end" });
  }, [initialMessages]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed.length === 0 || sendPending) return;

    const quoteToSend = pendingQuote;
    // Optimistic-ish: clear the composer immediately so the user sees the
    // form reset even while the server round-trip is in flight. On error we
    // restore via toast — the cleared draft is the price of UX snappiness.
    setDraft("");
    setPendingQuote(null);

    startSendTransition(async () => {
      const result = await sendMessageAction(
        threadId,
        trimmed,
        quoteToSend?.id ?? null,
      );
      if (!result.ok) {
        toast.error(result.error);
        // Roll the draft back so the user can retry without retyping.
        setDraft(trimmed);
        setPendingQuote(quoteToSend);
      }
    });
  }

  function handleConfirmDelete() {
    const id = confirmDeleteId;
    if (!id) return;
    startDeleteTransition(async () => {
      const result = await deleteMessageAction(id);
      if (!result.ok) {
        toast.error(result.error);
      }
      setConfirmDeleteId(null);
    });
  }

  return (
    <div className="flex flex-col gap-1.5 pb-[calc(env(safe-area-inset-bottom)+84px)]">
      {renderItems.length === 0 ? (
        <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-[13px] text-muted-foreground">
          {friendNickname}님과의 첫 메시지를 남겨보세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {renderItems.map((item) => {
            if (item.kind === "date") {
              return (
                <li
                  key={`date-${item.key}`}
                  className="my-2 flex items-center justify-center"
                >
                  <span className="rounded-full bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    {item.label}
                  </span>
                </li>
              );
            }
            return (
              <MessageGroupView
                key={`group-${item.messages[0].id}`}
                group={item}
                friendNickname={friendNickname}
                onRequestDelete={(id) => setConfirmDeleteId(id)}
              />
            );
          })}
        </ul>
      )}
      <div ref={listEndRef} />

      <form
        onSubmit={handleSubmit}
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-border bg-background/95 px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3 backdrop-blur"
      >
        {pendingQuote ? (
          <div className="mb-2 flex items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2 text-[12px]">
            <CategoryIcon
              slug={pendingQuote.category_icon}
              className="size-3.5 text-muted-foreground"
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {pendingQuote.deleted
                ? "삭제된 소비"
                : `${pendingQuote.category_name ?? "기타"} · ${formatKRW(pendingQuote.amount)}`}
            </span>
            <button
              type="button"
              aria-label="인용 제거"
              onClick={() => setPendingQuote(null)}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) =>
              setDraft(event.target.value.slice(0, MESSAGE_MAX_LENGTH))
            }
            maxLength={MESSAGE_MAX_LENGTH}
            placeholder="메시지 보내기"
            rows={1}
            className="min-h-12 flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[14px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40 focus:bg-background"
          />
          <Button
            type="submit"
            disabled={draft.trim().length === 0 || sendPending}
            className="h-12 rounded-full px-4 text-[14px] font-semibold"
          >
            {sendPending ? "전송 중…" : "전송"}
          </Button>
        </div>
      </form>

      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open && !deletePending) setConfirmDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 메시지를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제한 메시지는 상대방의 대화창에서도 즉시 사라져요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirmDelete();
              }}
              disabled={deletePending}
              className={cn(
                buttonVariants({ variant: "destructive" }),
                "h-12 w-full rounded-full text-[15px] font-semibold",
              )}
            >
              {deletePending ? "삭제 중…" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type MessageGroupViewProps = {
  group: MessageGroup;
  friendNickname: string;
  onRequestDelete: (messageId: string) => void;
};

function MessageGroupView({
  group,
  friendNickname,
  onRequestDelete,
}: MessageGroupViewProps) {
  const lastMessage = group.messages[group.messages.length - 1];
  const timeLabel = formatChatTime(new Date(lastMessage.createdAt));

  return (
    <li
      className={cn(
        "flex flex-col",
        group.isMe ? "items-end" : "items-start",
        // Each message group gets its own gap-0.5 stack; gap-3 between groups
        // comes from the parent <ul>.
        "gap-0.5",
      )}
    >
      {!group.isMe ? (
        <p className="mb-1 px-1 text-[12px] font-medium text-muted-foreground">
          {friendNickname}
        </p>
      ) : null}

      {group.messages.map((message, idx) => {
        const isLast = idx === group.messages.length - 1;
        return (
          <MessageRow
            key={message.id}
            message={message}
            isMe={group.isMe}
            timeLabel={isLast ? timeLabel : null}
            canDelete={group.isMe}
            onRequestDelete={onRequestDelete}
          />
        );
      })}
    </li>
  );
}

type MessageRowProps = {
  message: DmChatMessage;
  isMe: boolean;
  timeLabel: string | null;
  canDelete: boolean;
  onRequestDelete: (messageId: string) => void;
};

function MessageRow({
  message,
  isMe,
  timeLabel,
  canDelete,
  onRequestDelete,
}: MessageRowProps) {
  // Emoji-only messages render as a chunky standalone bubble so reactions
  // sent via the transaction sheet read as reactions, not text. The regex
  // accepts pictographic code points plus the variation selectors and
  // zero-width joiners that compose multi-codepoint emoji (skin tone, family
  // glyphs, flags). Korean text like "ㅋㅋㅋ" is intentionally excluded.
  const trimmedContent = message.content.trim();
  const isReactionStyle =
    trimmedContent.length > 0 &&
    /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+$/u.test(trimmedContent);

  // Long-press handler. We use a single ref-stored timer that both touch and
  // mouse events drive — releasing/moving cancels the pending fire. We do NOT
  // suppress the synthetic click after a successful long-press because the
  // bubble has no click action; messages only ever react to long-press.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const startPress = () => {
    if (!canDelete) return;
    cancelPress();
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      onRequestDelete(message.id);
    }, LONG_PRESS_MS);
  };

  return (
    <div
      className={cn(
        "flex w-full items-end gap-1.5",
        isMe ? "justify-end" : "justify-start",
      )}
    >
      {isMe && timeLabel ? (
        <span className="mb-0.5 text-[10px] tabular-nums text-muted-foreground">
          {timeLabel}
        </span>
      ) : null}

      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-1",
          isMe ? "items-end" : "items-start",
        )}
      >
        {message.quote ? <QuoteCard quote={message.quote} mine={isMe} /> : null}
        <div
          onTouchStart={startPress}
          onTouchEnd={cancelPress}
          onTouchCancel={cancelPress}
          onTouchMove={cancelPress}
          onMouseDown={startPress}
          onMouseUp={cancelPress}
          onMouseLeave={cancelPress}
          onContextMenu={(event) => {
            // Suppress the native context menu on long-press (mobile Safari
            // fires this after ~300ms of touch-hold) so our 500ms timer is
            // what gates the AlertDialog.
            if (canDelete) event.preventDefault();
          }}
          className={cn(
            "select-none rounded-2xl px-3.5 py-2 text-[14px] leading-snug",
            isMe
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
            isReactionStyle && "bg-transparent px-1 py-0 text-[34px]",
          )}
          style={{ WebkitUserSelect: "none" }}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>

      {!isMe && timeLabel ? (
        <span className="mb-0.5 text-[10px] tabular-nums text-muted-foreground">
          {timeLabel}
        </span>
      ) : null}
    </div>
  );
}

function QuoteCard({
  quote,
  mine,
}: {
  quote: DmChatQuoteCard;
  mine: boolean;
}) {
  return (
    <div
      className={cn(
        "flex max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[12px]",
        mine ? "self-end" : "self-start",
      )}
    >
      <CategoryIcon
        slug={quote.category_icon}
        className="size-3.5 text-muted-foreground"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {quote.deleted ? "삭제된 소비" : (quote.category_name ?? "기타")}
        </p>
        {!quote.deleted ? (
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {formatKRW(quote.amount)}
            {quote.memo ? <span> · {quote.memo}</span> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
