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
// so the toggle shows ON and nothing ever arrives. On app entry we re-register
// the device's current subscription so its live endpoint is persisted again.
//
// forceFresh is deliberately FALSE here. pushManager.subscribe() is idempotent
// for a given VAPID key, so reusing getSubscription() yields a STABLE endpoint
// and the upsert merely refreshes last_seen_at in place — no new row. Passing
// forceFresh=true (as this once did) runs unsubscribe()+subscribe() on EVERY
// app open, minting a brand-new endpoint each time and piling up one
// push_subscriptions row per open (observed: 60 rows / 14 days for one user,
// all distinct endpoints, never re-seen). The self-heal still works without it:
// if the server row was pruned, re-registering the reused subscription
// re-inserts it. The only states reuse can't auto-recover — a local sub that is
// silently dead at Apple, or a VAPID-key rotation — are rare (Apple seldom
// 410s) / deploy-controlled, and both heal on the next settings re-toggle.
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
        const sub = await subscribeDevice(vapidPublicKey, false);
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
