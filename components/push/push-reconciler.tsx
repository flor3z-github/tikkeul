"use client";

import { useEffect } from "react";

import { registerPushSubscriptionAction } from "@/app/settings/actions";
import { isPushSupported, subscribeDevice } from "@/lib/push/client";

type Props = {
  vapidPublicKey: string;
  // True when the user has at least one notification opt-in flag on. We only
  // self-heal for users who actually want push — never re-subscribe someone
  // who opted out.
  enabled: boolean;
};

// Once-per-page-load guard shared across every mount so a remount (or two
// instances) can't re-trigger the reconcile and churn endpoints.
let reconciledThisLoad = false;

// Invisible self-healer for the "flag on, but no live subscription" silent
// failure: the server row gets pruned on a 404/410 (dead endpoint, PWA
// reinstall, SW eviction) while user_settings still says notifications are on,
// so the toggle shows ON and nothing ever arrives. On app entry we re-mint a
// fresh subscription (forceFresh drops any stale local one) and re-register it.
export function PushReconciler({ vapidPublicKey, enabled }: Props) {
  useEffect(() => {
    if (reconciledThisLoad) return;
    if (!enabled || !vapidPublicKey) return;
    if (!isPushSupported()) return;
    // Only heal when the OS permission is already granted — "default"/"denied"
    // can't be recovered without a user gesture, which the settings toggle and
    // nudge card own.
    if (Notification.permission !== "granted") return;

    reconciledThisLoad = true;
    void (async () => {
      try {
        const sub = await subscribeDevice(vapidPublicKey, true);
        await registerPushSubscriptionAction({
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          userAgent: navigator.userAgent,
        });
      } catch {
        // Best-effort and silent — the user didn't ask for anything here. The
        // settings toggle surfaces errors when they act explicitly.
      }
    })();
  }, [enabled, vapidPublicKey]);

  return null;
}
