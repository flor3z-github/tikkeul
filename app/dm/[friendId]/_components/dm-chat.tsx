"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
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
// Fallback bottom padding before the form has measured itself (~ form height
// with no pending-quote card). Real value comes from a ResizeObserver below.
const COMPOSER_FALLBACK_HEIGHT = 84;

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
  const [, startSendTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [composerHeight, setComposerHeight] = useState(COMPOSER_FALLBACK_HEIGHT);
  // Optimistic outbox: messages the viewer just sent that haven't been
  // confirmed by a router.refresh() / realtime arrival yet. Each carries a
  // client-generated UUID that the server insert reuses as the row id, so
  // the realtime echo lands with the same id and we can dedupe by id.
  const [pendingMessages, setPendingMessages] = useState<DmChatMessage[]>([]);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);

  // Scroll the window to the document bottom on the next frame so layout
  // (composer height, new message DOM) has settled. We deliberately do NOT
  // use scrollIntoView on listEndRef: the ref sits inside a wrapper whose
  // paddingBottom reserves space for the fixed composer, and scrollIntoView
  // aligns the ref's bottom — not the document bottom — with the viewport
  // bottom, which hides the last composerHeight px of messages behind the
  // composer. Scrolling to scrollHeight parks the padding under the composer
  // so the latest message sits flush above it.
  const scrollToEnd = (behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => {
      const target =
        document.scrollingElement?.scrollHeight ??
        document.documentElement.scrollHeight;
      window.scrollTo({ top: target, behavior });
    });
  };

  // The composer is position: fixed — its height changes when a quote card
  // appears/disappears or the textarea grows. We mirror that height (border-
  // box, so padding + safe-area are included) onto the message list's bottom
  // padding so the latest message never disappears behind the composer.
  useEffect(() => {
    const el = composerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.borderBoxSize?.[0];
        const height = box
          ? box.blockSize
          : (entry.target as HTMLElement).offsetHeight;
        if (height > 0) {
          setComposerHeight((prev) => {
            const next = Math.ceil(height);
            // When the composer grows/shrinks (quote card add/remove,
            // textarea wrap), re-anchor the list to the bottom so the
            // latest message stays in view instead of being pushed off.
            if (next !== prev) scrollToEnd();
            return next;
          });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Merge server messages with the optimistic outbox. We always append
  // pending messages at the end because they are by definition newer than
  // anything the server has shipped to this client. Entries whose id has
  // already arrived via initialMessages are dropped so we don't double-render.
  const mergedMessages = useMemo(() => {
    if (pendingMessages.length === 0) return initialMessages;
    const serverIds = new Set(initialMessages.map((m) => m.id));
    const liveOptimistic = pendingMessages.filter((m) => !serverIds.has(m.id));
    if (liveOptimistic.length === 0) return initialMessages;
    return [...initialMessages, ...liveOptimistic];
  }, [initialMessages, pendingMessages]);

  // Prune optimistic entries that have been confirmed by the server. This
  // runs whenever initialMessages identity changes (router.refresh), which
  // is the moment the realtime echo for our own insert lands. setState in
  // an effect triggers a follow-up render; that's accepted here because the
  // server array is the source of truth and we only want one of the two
  // copies to render.
  useEffect(() => {
    if (pendingMessages.length === 0) return;
    const serverIds = new Set(initialMessages.map((m) => m.id));
    if (pendingMessages.some((m) => serverIds.has(m.id))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingMessages((prev) =>
        prev.filter((m) => !serverIds.has(m.id)),
      );
    }
  }, [initialMessages, pendingMessages]);

  const renderItems = useMemo(
    () => buildRenderItems(mergedMessages, viewerId),
    [mergedMessages, viewerId],
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

  // Anchor at the bottom on initial mount before the browser paints, so the
  // user enters the thread at the latest message instead of seeing the top
  // and then jumping. useLayoutEffect is synchronous w.r.t. paint. We scroll
  // window to document bottom (not into the ref) for the same reason as
  // scrollToEnd above.
  useLayoutEffect(() => {
    const target =
      document.scrollingElement?.scrollHeight ??
      document.documentElement.scrollHeight;
    window.scrollTo({ top: target, behavior: "auto" });
  }, []);

  // Auto-scroll to the latest message whenever the list grows. We do this on
  // initialMessages identity changes (router.refresh swaps the array) rather
  // than tracking length so a reload after delete also re-anchors at the end.
  useEffect(() => {
    scrollToEnd();
  }, [initialMessages]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;

    const quoteToSend = pendingQuote;
    // Mint a client-side UUID and render the message instantly as part of
    // the merged list. The server action below reuses the same id, so the
    // realtime echo will dedupe against this entry rather than producing a
    // brief duplicate.
    const clientMessageId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimistic: DmChatMessage = {
      id: clientMessageId,
      senderId: viewerId,
      content: trimmed,
      createdAt: new Date().toISOString(),
      quote: quoteToSend,
    };

    setDraft("");
    setPendingQuote(null);
    setPendingMessages((prev) => [...prev, optimistic]);
    // Anchor to the bottom right away so the new optimistic row is visible
    // above the composer immediately, not after the realtime refresh.
    scrollToEnd();

    startSendTransition(async () => {
      const result = await sendMessageAction(
        threadId,
        trimmed,
        quoteToSend?.id ?? null,
        clientMessageId,
      );
      if (!result.ok) {
        toast.error(result.error);
        // Remove the optimistic row and roll the composer back so the user
        // can retry without retyping.
        setPendingMessages((prev) =>
          prev.filter((m) => m.id !== clientMessageId),
        );
        setDraft(trimmed);
        setPendingQuote(quoteToSend);
        return;
      }
      // Belt-and-suspenders: re-anchor after the server confirms in case the
      // realtime refresh hasn't fired yet (it will scroll again on arrival).
      scrollToEnd();
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
    <div
      className="flex flex-col gap-1.5"
      style={{
        // composerHeight is the form's border-box height which already
        // includes its safe-area-inset-bottom padding — don't add it again.
        paddingBottom: `${composerHeight}px`,
      }}
    >
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
        ref={composerRef}
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
            disabled={draft.trim().length === 0}
            className="h-12 rounded-full px-4 text-[14px] font-semibold"
          >
            전송
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
