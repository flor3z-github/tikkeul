/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Tikkeul has no offline support. The service worker exists only to make the
// app installable (manifest + standalone display + iOS home screen).
//
// - Static assets (HTML/CSS/JS/icons) are precached so the install prompt sees
//   a working app shell.
// - Every Supabase request bypasses the cache entirely — no spending data,
//   auth tokens, or REST responses should ever land in Cache Storage.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  disableDevLogs: true,
  runtimeCaching: [
    {
      matcher: ({ url }) =>
        url.hostname.endsWith(".supabase.co") ||
        url.pathname.startsWith("/rest/v1/") ||
        url.pathname.startsWith("/auth/v1/") ||
        url.pathname.startsWith("/storage/v1/") ||
        url.pathname.startsWith("/realtime/v1/"),
      handler: new NetworkOnly(),
    },
  ],
});

serwist.addEventListeners();

// ---------------------------------------------------------------------------
// Web Push handlers — friend spending notifications.
//
// The Edge Function `notify-friend-spending` sends JSON payloads of the form:
//   { title, body, url?, tag? }
// We always call showNotification (iOS rejects silent pushes and Chrome will
// surface a "site is running in the background" warning if we don't).
// ---------------------------------------------------------------------------

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

self.addEventListener("push", (event) => {
  let payload: PushPayload | null = null;
  if (event.data) {
    try {
      payload = event.data.json() as PushPayload;
    } catch {
      payload = { title: "티끌", body: event.data.text() };
    }
  }
  const title = payload?.title ?? "티끌";
  const body = payload?.body ?? "";
  const url = payload?.url ?? "/dashboard";
  const tag = payload?.tag;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: string } | undefined;
  const targetUrl = data?.url ?? "/dashboard";

  event.waitUntil(
    (async () => {
      // Dismiss every other Tikkeul notification still in the tray so a
      // single click clears the entire batch instead of leaving the rest
      // sitting in the OS notification center. getNotifications() returns
      // only this origin's notifications, and the just-clicked one is
      // already closed above so it won't appear in the list.
      const others = await self.registration.getNotifications();
      for (const n of others) n.close();

      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const origin = self.location.origin;
      const existing = allClients.find((client) => client.url.startsWith(origin));
      if (existing) {
        await existing.focus();
        if ("navigate" in existing && typeof existing.navigate === "function") {
          await existing.navigate(targetUrl);
        }
        return;
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

// Push services may rotate the subscription endpoint (browser update,
// permission reset). The browser fires pushsubscriptionchange before the old
// endpoint stops working; we resubscribe AND POST the new endpoint to the
// server. A same-origin fetch carries the auth cookies, so /api/push/sync can
// resolve the user and persist the rotated endpoint — otherwise the DB keeps
// the dead endpoint and the user silently stops receiving pushes (the exact
// failure this whole change set is fixing).
function subscriptionKeyToBase64(sub: PushSubscription, name: "p256dh" | "auth"): string {
  const key = sub.getKey(name);
  if (!key) return "";
  const bytes = new Uint8Array(key);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

self.addEventListener("pushsubscriptionchange", (event) => {
  const change = event as ExtendableEvent & {
    oldSubscription?: PushSubscription | null;
    newSubscription?: PushSubscription | null;
  };
  event.waitUntil(
    (async () => {
      let newSub = change.newSubscription ?? null;
      if (!newSub) {
        const oldSub = change.oldSubscription ?? null;
        const applicationServerKey = oldSub?.options.applicationServerKey ?? undefined;
        try {
          newSub = await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        } catch {
          // Resubscribe failed — the next /settings visit or the dashboard
          // PushReconciler will re-register through the normal flow.
          return;
        }
      }
      try {
        await fetch("/api/push/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            endpoint: newSub.endpoint,
            p256dh: subscriptionKeyToBase64(newSub, "p256dh"),
            auth: subscriptionKeyToBase64(newSub, "auth"),
          }),
        });
      } catch {
        // Best-effort: PushReconciler on the next app open backfills it.
      }
    })(),
  );
});
