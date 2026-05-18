"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/lib/utils/category-icon";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeKoreanDate } from "@/lib/utils/date";
import { formatKRW } from "@/lib/utils/money";

import { deleteMessageAction, sendMessageAction } from "../actions";

const MESSAGE_MAX_LENGTH = 500;

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

type Props = {
  threadId: string;
  viewerId: string;
  friendId: string;
  friendNickname: string;
  initialMessages: DmChatMessage[];
  prefilledQuote: DmChatQuoteCard | null;
};

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
  const [, startDeleteTransition] = useTransition();
  const listEndRef = useRef<HTMLDivElement | null>(null);

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

  function handleDelete(messageId: string) {
    startDeleteTransition(async () => {
      const result = await deleteMessageAction(messageId);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 pb-[calc(env(safe-area-inset-bottom)+96px)]">
      {initialMessages.length === 0 ? (
        <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-[13px] text-muted-foreground">
          {friendNickname}님과의 첫 메시지를 남겨보세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {initialMessages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              isMe={message.senderId === viewerId}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
      <div ref={listEndRef} />

      <form
        onSubmit={handleSubmit}
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-border bg-background/95 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur"
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
    </div>
  );
}

type MessageRowProps = {
  message: DmChatMessage;
  isMe: boolean;
  onDelete: (messageId: string) => void;
};

function MessageRow({ message, isMe, onDelete }: MessageRowProps) {
  // Emoji-only messages render as a chunky standalone bubble so reactions
  // sent via the transaction sheet read as reactions, not text. The regex
  // accepts pictographic code points plus the variation selectors and
  // zero-width joiners that compose multi-codepoint emoji (skin tone, family
  // glyphs, flags). Korean text like "ㅋㅋㅋ" is intentionally excluded.
  const trimmedContent = message.content.trim();
  const isReactionStyle =
    trimmedContent.length > 0 &&
    /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+$/u.test(trimmedContent);

  return (
    <li
      className={cn(
        "flex flex-col gap-1",
        isMe ? "items-end" : "items-start",
      )}
    >
      {message.quote ? <QuoteCard quote={message.quote} mine={isMe} /> : null}
      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-1 rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug",
          isMe
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
          isReactionStyle && "px-3 py-2 text-[24px]",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
      <div
        className={cn(
          "flex items-center gap-2 text-[11px] text-muted-foreground",
          isMe ? "justify-end" : "justify-start",
        )}
      >
        <span className="tabular-nums">
          {formatRelativeKoreanDate(new Date(message.createdAt))}
        </span>
        {isMe ? (
          <button
            type="button"
            aria-label="메시지 삭제"
            onClick={() => onDelete(message.id)}
            className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 hover:bg-muted"
          >
            <Trash2 className="size-3" />
            삭제
          </button>
        ) : null}
      </div>
    </li>
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
        "flex max-w-[78%] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[12px]",
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
