"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";

import {
  registerPushSubscriptionAction,
  setFriendSpendingNotificationsAction,
  setTransactionInteractionNotificationsAction,
} from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import {
  isIos,
  isPushSupported,
  isStandalonePwa,
  subscribeDevice,
} from "@/lib/push/client";

// Once the user dismisses this card we never bring it back. The settings
// page still owns the canonical toggle, so a permanent dismiss avoids
// re-nagging a user who already said "no".
const DISMISS_KEY = "tikkeul:notif-nudge:dismissed";

type Props = {
  vapidPublicKey: string;
};

// Eligibility is derived from browser APIs that only exist on the client.
// Reading it via useSyncExternalStore lets the SSR snapshot start false
// (so the card is absent from the server-rendered HTML), then transition
// to true on hydration without triggering the
// react-hooks/set-state-in-effect lint rule.
function readEligible(): boolean {
  if (typeof window === "undefined") return false;
  if (!isPushSupported()) return false;
  // Only nudge when the OS-level permission has not been asked yet.
  // "granted" => already opted in elsewhere; "denied" => no fresh prompt.
  if (Notification.permission !== "default") return false;
  // iOS only delivers Web Push from a home-screen-installed PWA.
  if (isIos() && !isStandalonePwa()) return false;
  try {
    if (window.localStorage.getItem(DISMISS_KEY)) return false;
  } catch {
    // Private-mode storage access errors — treat as "not dismissed".
  }
  return true;
}

// No external events to listen for — eligibility only changes via the
// dismiss/enable handlers below, which drive local state directly.
function subscribeNoop() {
  return () => {};
}

export function NotificationNudgeCard({ vapidPublicKey }: Props) {
  const eligible = useSyncExternalStore(
    subscribeNoop,
    readEligible,
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState(false);

  const visible = Boolean(vapidPublicKey) && eligible && !dismissed;
  if (!visible) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {
      // ignore — best-effort persistence.
    }
    setDismissed(true);
  }

  async function enable() {
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") {
          toast.error(
            "알림 권한이 차단됐어요. 브라우저 설정에서 허용해주세요.",
          );
          // Cannot recover from "denied" via JS, so retire the card.
          dismiss();
        }
        return;
      }
      const sub = await subscribeDevice(vapidPublicKey);
      const registerResult = await registerPushSubscriptionAction({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        userAgent: navigator.userAgent,
      });
      if (!registerResult.ok) {
        toast.error(registerResult.error);
        return;
      }
      // Flip every notification opt-in flag on. The card is the generic
      // "turn on app pushes" surface — granular control still lives in
      // settings. New flags added later should join this Promise.all.
      const [friendResult, interactionResult] = await Promise.all([
        setFriendSpendingNotificationsAction(true),
        setTransactionInteractionNotificationsAction(true),
      ]);
      if (!friendResult.ok) {
        toast.error(friendResult.error);
        return;
      }
      if (!interactionResult.ok) {
        toast.error(interactionResult.error);
        return;
      }
      toast.success("알림을 켰어요.");
      dismiss();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "알림을 켜지 못했어요.";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="mt-4 flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
      role="region"
      aria-label="푸시 알림 안내"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Bell className="size-5" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          알림을 받아볼래요?
        </p>
        <p className="text-xs text-muted-foreground">
          친구 소비·반응·댓글 등 새 활동을 알려드려요.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="default"
        onClick={enable}
        disabled={pending}
      >
        켜기
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="알림 안내 닫기"
        onClick={dismiss}
        disabled={pending}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
