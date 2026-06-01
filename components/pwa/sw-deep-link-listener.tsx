"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { resolveNextTarget } from "@/lib/utils/deep-link";

// iOS standalone PWA quirk: when the app is already open (backgrounded-alive)
// and the user taps a push notification, the service worker's
// `notificationclick` handler focuses the existing window but
// `WindowClient.navigate()` is a no-op on WebKit standalone — the route never
// changes, so the user is left on whatever screen was showing (usually the
// dashboard). The cold-start path (openWindow + `/?next=`) is unaffected; only
// this warm path was broken (verified on-device 2026-06-01).
//
// Fix: the SW posts a `{ type: "tikkeul-deep-link", url }` message to the
// focused client (see app/sw.ts) instead of relying on navigate(); this
// component — mounted once in the root layout — receives it and performs a
// client-side `router.push`, which WebKit honors because the page navigates
// itself. The url is re-validated through `resolveNextTarget` so a stray
// postMessage can't be turned into an open redirect.
export function SwDeepLinkListener() {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | undefined;
      if (data?.type !== "tikkeul-deep-link") return;
      router.push(resolveNextTarget(data.url ?? null));
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [router]);

  return null;
}
