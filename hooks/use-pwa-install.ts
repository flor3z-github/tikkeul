"use client";

import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "pwa-install-dismissed-until";
const INSTALLED_KEY = "pwa-install-known-installed";
const DISMISS_DAYS = 7;

// `beforeinstallprompt` is not in lib.dom yet. Minimal shape we touch.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaInstallStatus =
  | "loading"
  | "installed" // running as PWA OR previously installed in this browser
  | "promptable" // beforeinstallprompt captured — native prompt available
  | "ios" // iOS Safari — manual add-to-home-screen instructions
  | "unsupported" // no native prompt and not iOS — generic instructions
  | "dismissed"; // user dismissed and the cooldown is still active

export type UsePwaInstall = {
  status: PwaInstallStatus;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  dismiss: () => void;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari uses the non-standard navigator.standalone flag.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOSDevice = /iPhone|iPad|iPod/.test(ua);
  // Exclude in-app browsers (Chrome on iOS, etc.) — they can't add to home
  // screen from their own share sheet, so the instructions would be wrong.
  const isCriOSorFxiOS = /CriOS|FxiOS|EdgiOS/.test(ua);
  return iOSDevice && !isCriOSorFxiOS;
}

function isDismissActive(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const until = Number(raw);
  if (!Number.isFinite(until)) return false;
  return Date.now() < until;
}

function wasInstalledHere(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(INSTALLED_KEY) === "1";
}

export function usePwaInstall(): UsePwaInstall {
  const [status, setStatus] = useState<PwaInstallStatus>("loading");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const resolveInitial = () => {
      if (isStandalone() || wasInstalledHere()) {
        setStatus("installed");
        return;
      }
      if (isDismissActive()) {
        setStatus("dismissed");
        return;
      }
      // No prompt captured yet — fall back to iOS or unsupported. If
      // beforeinstallprompt fires later, the listener below upgrades this.
      setStatus(isIosSafari() ? "ios" : "unsupported");
    };

    resolveInitial();

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(evt);
      // Only upgrade visibility if we're not already hiding the banner.
      setStatus((prev) =>
        prev === "installed" || prev === "dismissed" ? prev : "promptable",
      );
    };

    const onAppInstalled = () => {
      window.localStorage.setItem(INSTALLED_KEY, "1");
      setDeferredPrompt(null);
      setStatus("installed");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    // Re-evaluate when the user switches the app between standalone and
    // browser tabs (PWA exit, share-to-Safari from installed app, etc.).
    const mql = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = () => resolveInitial();
    mql.addEventListener?.("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      mql.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return "unavailable" as const;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") {
      window.localStorage.setItem(INSTALLED_KEY, "1");
      setStatus("installed");
    } else {
      // User clicked the system "Cancel" — treat like a banner dismiss so
      // we don't immediately reoffer the native prompt on the next render.
      const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
      window.localStorage.setItem(DISMISS_KEY, String(until));
      setStatus("dismissed");
    }
    return choice.outcome;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    if (typeof window === "undefined") return;
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(DISMISS_KEY, String(until));
    setStatus("dismissed");
  }, []);

  return { status, promptInstall, dismiss };
}
