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
