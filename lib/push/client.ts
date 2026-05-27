// Browser-side Web Push helpers. Server is unaware of these; they bridge the
// browser PushManager API to the server actions in app/settings/actions.ts.
//
// The serialized PushSubscription is what the server stores in
// public.push_subscriptions and what web-push later signs/encrypts against.

export type SerializedPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// Web Push standard: VAPID public keys are urlsafe-base64 strings that the
// PushManager wants as a Uint8Array. atob can't decode urlsafe directly.
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function serialize(subscription: PushSubscription): SerializedPushSubscription {
  return {
    endpoint: subscription.endpoint,
    p256dh: arrayBufferToBase64(subscription.getKey("p256dh")),
    auth: arrayBufferToBase64(subscription.getKey("auth")),
  };
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// iOS Safari only allows Web Push from a PWA installed to the home screen.
// Detect the two standalone signals so the UI can show the right hint.
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneMatch = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(standaloneMatch || iosStandalone);
}

export function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // navigator.serviceWorker.ready never resolves when the SW failed to
  // activate (observed on Samsung Internet). Cap the wait so callers surface a
  // "service worker is not ready" error instead of hanging the toggle forever.
  try {
    return (await withTimeout(navigator.serviceWorker.ready, 10000, "Service worker did not become ready")) ?? null;
  } catch {
    return null;
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

// Subscribe (or reuse) the device. Caller must have already verified that
// Notification.permission === "granted" — this function does not prompt.
//
// forceFresh: a locally-cached PushSubscription can already be dead server-side
// (the Edge Function prunes it on a 404/410) or signed against a rotated VAPID
// key, while getSubscription() still hands it back. Re-registering that stale
// endpoint silently re-creates the same broken subscription. When the caller
// wants a guaranteed-live endpoint (re-enabling a toggle, reconcile-on-load),
// pass forceFresh to drop the stale local subscription and mint a new one.
export async function subscribeDevice(
  vapidPublicKey: string,
  forceFresh = false,
): Promise<SerializedPushSubscription> {
  if (!vapidPublicKey) {
    throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured");
  }
  const registration = await getRegistration();
  if (!registration) {
    throw new Error("Service worker is not ready");
  }
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && forceFresh) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
    });
  }
  return serialize(subscription);
}

export async function unsubscribeDevice(): Promise<SerializedPushSubscription | null> {
  const subscription = await getExistingSubscription();
  if (!subscription) return null;
  const serialized = serialize(subscription);
  await subscription.unsubscribe();
  return serialized;
}
