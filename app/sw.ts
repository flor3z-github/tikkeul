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
// endpoint stops working; resubscribe and let the next server interaction
// re-register the new endpoint. The SW itself can't talk to the server here
// without credentials, so we just refresh the local subscription.
self.addEventListener("pushsubscriptionchange", (event) => {
  const change = event as ExtendableEvent & {
    oldSubscription?: PushSubscription | null;
    newSubscription?: PushSubscription | null;
  };
  event.waitUntil(
    (async () => {
      const oldSub = change.oldSubscription ?? null;
      if (!oldSub) return;
      const applicationServerKey = oldSub.options.applicationServerKey ?? undefined;
      try {
        await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      } catch {
        // Best-effort: if resubscribe fails the next /settings visit will
        // re-prompt and re-register through the normal flow.
      }
    })(),
  );
});
