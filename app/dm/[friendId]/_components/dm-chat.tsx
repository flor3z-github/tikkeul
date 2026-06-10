"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, CornerUpLeft, Trash2, X } from "lucide-react";
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
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
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

import {
  deleteMessageAction,
  markThreadReadAction,
  sendMessageAction,
} from "../actions";

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
  category_color: string | null;
};

// A message-to-message quote reply. `content` is the replied-to message's text
// (rendered as a one-line preview); `deleted` is true when the target couldn't
// be resolved (hard-deleted), in which case the UI shows a "삭제된 메시지" stub.
export type DmChatReply = {
  id: string;
  senderId: string;
  content: string;
  deleted: boolean;
};

export type DmChatMessage = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  quote: DmChatQuoteCard | null;
  replyTo: DmChatReply | null;
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
  /** dm_messages.id to scroll to + briefly highlight on mount. Used by the
   *  dashboard comment-trace deep link. When null, the chat behaves normally
   *  and anchors at the bottom. */
  targetMessageId: string | null;
};

const HIGHLIGHT_MS = 1500;

// Ring flash applied to a message when it's scrolled into view (deep-link on
// mount, or tapping a reply card to jump to the original). Listed as static
// string literals so Tailwind's content scanner picks them up at build time.
// Tailwind: ring-2 ring-primary/50 ring-offset-2 ring-offset-background rounded-2xl
const HIGHLIGHT_CLASSES = [
  "ring-2",
  "ring-primary/50",
  "ring-offset-2",
  "ring-offset-background",
  "rounded-2xl",
];

function mintUUIDv4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

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
      // Quoted messages (transaction quote OR a message reply) start their own
      // group so the quote/reply card always sits at the visual top of the
      // bubble cluster instead of being orphaned.
      message.quote === null &&
      message.replyTo === null &&
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
  targetMessageId,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [pendingQuote, setPendingQuote] = useState<DmChatQuoteCard | null>(
    prefilledQuote,
  );
  const [pendingReply, setPendingReply] = useState<DmChatReply | null>(null);
  const [, startSendTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // The long-pressed message whose action sheet (답장 / 삭제) is open. Holds the
  // whole message so the sheet can build the reply snippet and decide whether
  // 삭제 shows (own messages only).
  const [actionSheetMessage, setActionSheetMessage] =
    useState<DmChatMessage | null>(null);
  // Set true by the 답장 action so the sheet's onCloseAutoFocus re-focuses the
  // composer (and only then) — see handleReplyFromSheet.
  const focusComposerOnCloseRef = useRef(false);
  const [composerHeight, setComposerHeight] = useState(COMPOSER_FALLBACK_HEIGHT);
  // While true, suppress every auto-scroll-to-bottom path (composer resize,
  // initialMessages refresh) so the user stays parked on the deep-linked
  // message instead of getting yanked to the latest row. Flipped off when the
  // highlight flash ends.
  const parkedAtTargetRef = useRef(false);
  // Optimistic outbox: messages the viewer just sent that haven't been
  // confirmed by a router.refresh() / realtime arrival yet. Each carries a
  // client-generated UUID that the server insert reuses as the row id, so
  // the realtime echo lands with the same id and we can dedupe by id.
  const [pendingMessages, setPendingMessages] = useState<DmChatMessage[]>([]);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Tracks the in-flight reply-jump highlight (timer + element) so overlapping
  // taps cancel the previous flash instead of leaving a stuck ring / flipping
  // parkedAtTarget off under a newer jump. See scrollToMessage.
  const jumpHighlightRef = useRef<{
    timer: ReturnType<typeof setTimeout>;
    el: HTMLElement;
  } | null>(null);

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
            // Skip while parked at a deep-link target — otherwise the
            // composer's initial measure right after mount would yank the
            // user away from the highlighted message.
            if (next !== prev && !parkedAtTargetRef.current) scrollToEnd();
            return next;
          });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // iOS soft-keyboard handling. Two iOS Safari quirks combine to break the
  // DM chat layout:
  //   1) When the keyboard opens, visualViewport shrinks but the layout
  //      viewport stays the same. A `position: fixed; bottom: 0` composer
  //      ends up *behind* the keyboard.
  //   2) When the textarea gets focus, iOS scrolls the layout viewport so
  //      the input is centered in the visualViewport. `vv.offsetTop` becomes
  //      positive. A `sticky; top: 0` header anchored to layout-viewport
  //      coordinates slides *above* the visible area — the user sees only
  //      messages clipped by the iOS status bar (or nothing at all).
  // Mirror DrawerContent's pattern: anchor the header's top to the
  // visualViewport top (`vv.offsetTop`) and the composer's bottom to the
  // visualViewport bottom (`innerHeight - vv.offsetTop - vv.height`). Reset
  // both when the keyboard is dismissed so the safe-area rules in CSS take
  // back over.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    function applyKeyboardInset() {
      const headerEl = headerRef.current;
      const composerEl = composerRef.current;
      // Treat any meaningful shrink as a keyboard event. Mobile Safari's URL
      // bar can also shrink visualViewport by ~50–80px during ordinary
      // scroll; ignore anything below 100px so we don't reposition for that.
      const keyboardHeight = window.innerHeight - vv!.height;
      const open = keyboardHeight > 100;
      if (open) {
        if (headerEl) headerEl.style.top = `${vv!.offsetTop}px`;
        if (composerEl) {
          const bottomInset = Math.max(
            0,
            window.innerHeight - vv!.offsetTop - vv!.height,
          );
          composerEl.style.bottom = `${bottomInset}px`;
        }
      } else {
        if (headerEl) headerEl.style.top = "";
        if (composerEl) composerEl.style.bottom = "";
      }
    }

    vv.addEventListener("resize", applyKeyboardInset);
    // iOS scrolls the visualViewport (not just resizes it) when the textarea
    // is focused — without the scroll listener the header doesn't follow.
    vv.addEventListener("scroll", applyKeyboardInset);
    applyKeyboardInset();
    // Re-measure across focus changes — iOS sometimes fires the keyboard
    // resize before the layout has reflowed.
    const onFocus = () => {
      requestAnimationFrame(applyKeyboardInset);
      setTimeout(applyKeyboardInset, 100);
      setTimeout(applyKeyboardInset, 300);
    };
    window.addEventListener("focusin", onFocus);
    window.addEventListener("focusout", onFocus);
    return () => {
      vv.removeEventListener("resize", applyKeyboardInset);
      vv.removeEventListener("scroll", applyKeyboardInset);
      window.removeEventListener("focusin", onFocus);
      window.removeEventListener("focusout", onFocus);
    };
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

  // Mark the thread read on enter. Moved out of the page's RSC render so the
  // action can call revalidatePath: this busts the /dm index + dashboard
  // Router Cache so back-navigation (swipe or button) refetches the read-
  // cleared unread counts instead of the staleTimes:30 pre-read snapshot.
  // Keyed on threadId only — fires once per thread open. While-viewing
  // arrivals are re-marked by the realtime handler below (not here), so this
  // effect can't loop on the action's own refresh.
  useEffect(() => {
    void markThreadReadAction(threadId);
  }, [threadId]);

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
      timer = setTimeout(() => {
        // A message landed while the thread is open. Re-mark read so messages
        // that arrive during active viewing don't resurface as unread after
        // the user leaves; the action also re-busts the /dm + /dashboard cache.
        void markThreadReadAction(threadId);
        router.refresh();
      }, 300);
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
  //
  // When `targetMessageId` is supplied (dashboard comment-trace deep link),
  // try to scroll that message into view instead. If it isn't in the loaded
  // batch (older than the 200-msg window) we fall back to the bottom anchor
  // and surface a toast so the deep link doesn't fail silently.
  useLayoutEffect(() => {
    if (targetMessageId) {
      const el = document.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(targetMessageId)}"]`,
      );
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "auto" });
        // Apply the highlight directly via classList rather than via React
        // state to avoid setState-in-effect (react-hooks/set-state-in-effect).
        el.classList.add(...HIGHLIGHT_CLASSES);
        parkedAtTargetRef.current = true;
        // Brief highlight flash; afterwards let normal auto-scroll resume so
        // realtime arrivals / composer resizes re-anchor at the bottom again.
        const timer = setTimeout(() => {
          parkedAtTargetRef.current = false;
          el.classList.remove(...HIGHLIGHT_CLASSES);
        }, HIGHLIGHT_MS);
        return () => {
          clearTimeout(timer);
          el.classList.remove(...HIGHLIGHT_CLASSES);
          parkedAtTargetRef.current = false;
        };
      }
      toast.error("메시지를 찾을 수 없어요.");
    }
    const target =
      document.scrollingElement?.scrollHeight ??
      document.documentElement.scrollHeight;
    window.scrollTo({ top: target, behavior: "auto" });
  }, [targetMessageId]);

  // Auto-scroll to the latest message whenever the list grows. We do this on
  // initialMessages identity changes (router.refresh swaps the array) rather
  // than tracking length so a reload after delete also re-anchors at the end.
  // Skip while parked at a deep-link target so the user isn't yanked away.
  useEffect(() => {
    if (parkedAtTargetRef.current) return;
    scrollToEnd();
  }, [initialMessages]);

  // Scroll a message into view + flash it. Used when the viewer taps a reply
  // card to jump to the message it quotes. If the target isn't in the loaded
  // batch (older than the 200-msg window) we surface a toast rather than fail
  // silently. Mirrors the deep-link highlight in the useLayoutEffect above.
  function scrollToMessage(messageId: string) {
    const el = document.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(messageId)}"]`,
    );
    if (!el) {
      toast.error("원본 메시지를 찾을 수 없어요.");
      return;
    }
    // Cancel any in-flight highlight from a previous tap before starting a new
    // one, so a stale timer can't strip the ring / un-park under this jump.
    if (jumpHighlightRef.current) {
      clearTimeout(jumpHighlightRef.current.timer);
      jumpHighlightRef.current.el.classList.remove(...HIGHLIGHT_CLASSES);
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add(...HIGHLIGHT_CLASSES);
    parkedAtTargetRef.current = true;
    const timer = setTimeout(() => {
      parkedAtTargetRef.current = false;
      el.classList.remove(...HIGHLIGHT_CLASSES);
      jumpHighlightRef.current = null;
    }, HIGHLIGHT_MS);
    jumpHighlightRef.current = { timer, el };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;

    // Keep focus on the textarea so iOS Safari doesn't slide the soft
    // keyboard down between sends. Must run synchronously inside the
    // submit user-gesture tick — a focus() call from a later async
    // continuation (after the server action resolves) is too late, iOS
    // has already dismissed the keyboard. The send button below also
    // suppresses mousedown/touchstart focus transfer, so this focus()
    // is mostly a belt-and-suspenders re-anchor.
    textareaRef.current?.focus();

    const quoteToSend = pendingQuote;
    const replyToSend = pendingReply;
    // Mint a client-side UUID and render the message instantly as part of
    // the merged list. The server action below reuses the same id, so the
    // realtime echo will dedupe against this entry rather than producing a
    // brief duplicate. The server validates the id against an RFC4122 regex,
    // so the fallback must also produce a valid UUID — not a random string.
    // crypto.randomUUID requires a secure context (HTTPS / localhost), which
    // breaks on LAN HTTP dev (NEXT_DEV_ALLOWED_ORIGINS=192.168.x.y). Fall
    // back to crypto.getRandomValues, which works in insecure contexts.
    const clientMessageId = mintUUIDv4();
    const optimistic: DmChatMessage = {
      id: clientMessageId,
      senderId: viewerId,
      content: trimmed,
      createdAt: new Date().toISOString(),
      quote: quoteToSend,
      replyTo: replyToSend,
    };

    setDraft("");
    setPendingQuote(null);
    setPendingReply(null);
    setPendingMessages((prev) => [...prev, optimistic]);
    // Anchor to the bottom right away so the new optimistic row is visible
    // above the composer immediately, not after the realtime refresh.
    scrollToEnd();

    startSendTransition(async () => {
      const result = await sendMessageAction(
        threadId,
        trimmed,
        quoteToSend?.id ?? null,
        replyToSend?.id ?? null,
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
        setPendingReply(replyToSend);
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

  // 답장: attach the long-pressed message as the pending reply and close the
  // sheet. The actual focus happens in the Drawer's onCloseAutoFocus (gated by
  // focusComposerOnCloseRef) — focusing the textarea while the modal sheet is
  // still open is fought by vaul's focus trap, and a focus() after the close
  // animation lands outside the user-gesture tick so iOS won't raise the
  // keyboard. Preventing the auto-focus + focusing on close is the Radix-blessed
  // path; it's still best-effort on iOS, but the 답장 중 banner shows either way
  // so the user can always tap the composer to type.
  function handleReplyFromSheet() {
    const m = actionSheetMessage;
    if (!m) return;
    setPendingReply({
      id: m.id,
      senderId: m.senderId,
      content: m.content,
      deleted: false,
    });
    focusComposerOnCloseRef.current = true;
    setActionSheetMessage(null);
  }

  // 삭제: close the sheet and open the existing delete-confirm AlertDialog. Only
  // wired for own messages (the 삭제 button isn't rendered for friend bubbles).
  function handleDeleteFromSheet() {
    const m = actionSheetMessage;
    if (!m) return;
    setActionSheetMessage(null);
    setConfirmDeleteId(m.id);
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
      {/* Sticky header lives inside the chat client so the visualViewport
          effect above can pin it to the visualViewport top when the iOS
          keyboard opens. Otherwise iOS scrolls the layout viewport for
          textarea focus and the layout-top-0 header slides above the
          visible area. */}
      <div
        ref={headerRef}
        className="sticky top-0 z-20 -mx-5 mb-2 flex items-center gap-2 border-b border-border/40 bg-background/95 px-3 py-2 backdrop-blur"
      >
        <Link
          href="/dashboard"
          aria-label="대시보드로 돌아가기"
          className="-ml-1 inline-flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="flex-1 truncate text-center text-[15px] font-semibold tracking-tight">
          {friendNickname}
        </h1>
        <div className="size-9 shrink-0" aria-hidden />
      </div>

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
                onLongPress={(m) => setActionSheetMessage(m)}
                onJumpToMessage={scrollToMessage}
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
        {pendingReply ? (
          <div className="mb-2 flex items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2 text-[12px]">
            <CornerUpLeft className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {pendingReply.deleted ? "삭제된 메시지" : pendingReply.content}
            </span>
            <button
              type="button"
              aria-label="답장 취소"
              onClick={() => setPendingReply(null)}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
        {pendingQuote ? (
          <div className="mb-2 flex items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2 text-[12px]">
            <CategoryIcon
              slug={pendingQuote.category_icon}
              className={cn(
                "size-3.5",
                !pendingQuote.category_color && "text-muted-foreground",
              )}
              style={
                pendingQuote.category_color
                  ? { color: pendingQuote.category_color }
                  : undefined
              }
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
            ref={textareaRef}
            value={draft}
            onChange={(event) =>
              setDraft(event.target.value.slice(0, MESSAGE_MAX_LENGTH))
            }
            maxLength={MESSAGE_MAX_LENGTH}
            placeholder="메시지 보내기"
            rows={1}
            inputMode="text"
            enterKeyHint="send"
            className="min-h-12 flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[14px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40 focus:bg-background"
          />
          <Button
            type="submit"
            disabled={draft.trim().length === 0}
            // Suppress focus transfer to the button on tap. Without this,
            // iOS Safari blurs the textarea on the pointer-down event → the
            // soft keyboard slides down → the next send needs a re-tap on
            // the textarea. preventDefault on pointerdown keeps focus where
            // it is and, unlike touchstart.preventDefault, does NOT cancel
            // the subsequent click on iOS Safari.
            onPointerDown={(event) => event.preventDefault()}
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

      <Drawer
        open={actionSheetMessage !== null}
        onOpenChange={(open) => {
          if (!open) setActionSheetMessage(null);
        }}
      >
        <DrawerContent
          // Keep focus on the textarea that 답장 just focused (via the ref flag)
          // so iOS can raise the keyboard; without preventDefault vaul returns
          // focus to the body on close and the keyboard never opens.
          onCloseAutoFocus={(event) => {
            if (focusComposerOnCloseRef.current) {
              event.preventDefault();
              focusComposerOnCloseRef.current = false;
              textareaRef.current?.focus();
            }
          }}
          className="px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-1"
        >
          <DrawerTitle className="sr-only">메시지 작업</DrawerTitle>
          <div className="flex flex-col gap-1 py-1">
            <button
              type="button"
              onClick={handleReplyFromSheet}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] font-medium text-foreground transition-colors active:bg-muted"
            >
              <CornerUpLeft className="size-[18px] text-muted-foreground" />
              답장
            </button>
            {actionSheetMessage?.senderId === viewerId ? (
              <button
                type="button"
                onClick={handleDeleteFromSheet}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] font-medium text-destructive transition-colors active:bg-destructive/10"
              >
                <Trash2 className="size-[18px]" />
                삭제
              </button>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

type MessageGroupViewProps = {
  group: MessageGroup;
  friendNickname: string;
  onLongPress: (message: DmChatMessage) => void;
  onJumpToMessage: (messageId: string) => void;
};

function MessageGroupView({
  group,
  friendNickname,
  onLongPress,
  onJumpToMessage,
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
            onLongPress={onLongPress}
            onJumpToMessage={onJumpToMessage}
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
  onLongPress: (message: DmChatMessage) => void;
  onJumpToMessage: (messageId: string) => void;
};

function MessageRow({
  message,
  isMe,
  timeLabel,
  onLongPress,
  onJumpToMessage,
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
  // Long-press is universal now (reply works on BOTH own and friend bubbles);
  // the sheet itself decides which actions (답장 / 삭제) to show.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const startPress = () => {
    cancelPress();
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      onLongPress(message);
    }, LONG_PRESS_MS);
  };

  return (
    <div
      data-message-id={message.id}
      className={cn(
        "flex w-full items-end gap-1.5 scroll-mt-20 transition-shadow duration-300",
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
        {message.replyTo ? (
          <ReplyCard
            reply={message.replyTo}
            mine={isMe}
            onJump={onJumpToMessage}
          />
        ) : null}
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
            // what gates the action sheet.
            event.preventDefault();
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

function ReplyCard({
  reply,
  mine,
  onJump,
}: {
  reply: DmChatReply;
  mine: boolean;
  onJump: (messageId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!reply.deleted) onJump(reply.id);
      }}
      disabled={reply.deleted}
      className={cn(
        "flex max-w-full items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-left text-[12px]",
        mine ? "self-end" : "self-start",
        reply.deleted ? "opacity-70" : "transition-colors active:bg-muted/60",
      )}
    >
      <CornerUpLeft className="size-3 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {reply.deleted ? "삭제된 메시지" : reply.content}
      </span>
    </button>
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
        className={cn(
          "size-3.5",
          !quote.category_color && "text-muted-foreground",
        )}
        style={
          quote.category_color
            ? { color: quote.category_color }
            : undefined
        }
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
