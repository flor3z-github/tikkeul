"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import {
  registerPushSubscriptionAction,
  setFriendSpendingNotificationsAction,
  unregisterPushSubscriptionAction,
} from "@/app/settings/actions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getExistingSubscription,
  isIos,
  isPushSupported,
  isStandalonePwa,
  subscribeDevice,
  unsubscribeDevice,
} from "@/lib/push/client";

type Props = {
  initialEnabled: boolean;
  vapidPublicKey: string;
};

type PermissionState = NotificationPermission | "unsupported";

type PushEnv = {
  permission: PermissionState;
  needsPwaInstall: boolean;
};

const SERVER_ENV: PushEnv = { permission: "default", needsPwaInstall: false };

// useSyncExternalStore requires getSnapshot to return a referentially stable
// value when the underlying state has not changed. Cache the last snapshot
// and only allocate a fresh object when one of the fields actually differs.
let cachedSnapshot: PushEnv | null = null;

const permissionListeners = new Set<() => void>();

function notifyPushEnvChanged() {
  cachedSnapshot = null;
  permissionListeners.forEach((listener) => listener());
}

function readPushEnv(): PushEnv {
  if (typeof window === "undefined") return SERVER_ENV;
  const supported = isPushSupported();
  const permission: PermissionState = supported
    ? Notification.permission
    : "unsupported";
  const needsPwaInstall = supported && isIos() && !isStandalonePwa();
  if (
    cachedSnapshot &&
    cachedSnapshot.permission === permission &&
    cachedSnapshot.needsPwaInstall === needsPwaInstall
  ) {
    return cachedSnapshot;
  }
  cachedSnapshot = { permission, needsPwaInstall };
  return cachedSnapshot;
}

function subscribeToPushEnv(callback: () => void): () => void {
  permissionListeners.add(callback);
  let cleanupPermissionStatus: (() => void) | null = null;
  if (
    typeof window !== "undefined" &&
    "permissions" in navigator &&
    typeof navigator.permissions?.query === "function"
  ) {
    navigator.permissions
      .query({ name: "notifications" as PermissionName })
      .then((status) => {
        const onChange = () => notifyPushEnvChanged();
        status.addEventListener("change", onChange);
        cleanupPermissionStatus = () => status.removeEventListener("change", onChange);
      })
      .catch(() => {
        // Older Safari rejects the query — that's fine, we just lose the live
        // sync. The manual notifyPushEnvChanged after requestPermission keeps
        // the toggle in step with the user's response.
      });
  }
  return () => {
    permissionListeners.delete(callback);
    cleanupPermissionStatus?.();
  };
}

export function FriendNotificationsToggle({ initialEnabled, vapidPublicKey }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const env = useSyncExternalStore(
    subscribeToPushEnv,
    readPushEnv,
    () => SERVER_ENV,
  );
  const { permission, needsPwaInstall } = env;

  const disabled =
    pending ||
    permission === "unsupported" ||
    permission === "denied" ||
    needsPwaInstall ||
    !vapidPublicKey;

  async function turnOn() {
    if (permission === "default") {
      const next = await Notification.requestPermission();
      notifyPushEnvChanged();
      if (next !== "granted") {
        toast.error("알림 권한이 필요해요.");
        return;
      }
    }
    if (Notification.permission !== "granted") {
      toast.error("알림 권한이 차단돼있어요. 브라우저 설정에서 허용해주세요.");
      return;
    }
    try {
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
      const toggleResult = await setFriendSpendingNotificationsAction(true);
      if (!toggleResult.ok) {
        toast.error(toggleResult.error);
        return;
      }
      setEnabled(true);
      toast.success("친구 소비 알림을 켰어요.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "알림을 켜지 못했어요.";
      toast.error(message);
    }
  }

  async function turnOff() {
    try {
      const toggleResult = await setFriendSpendingNotificationsAction(false);
      if (!toggleResult.ok) {
        toast.error(toggleResult.error);
        return;
      }
      const removed = await unsubscribeDevice();
      if (removed) {
        await unregisterPushSubscriptionAction(removed.endpoint);
      } else {
        // Subscription may have already been revoked at the browser level.
        // Best-effort cleanup of any stale row for the current endpoint.
        const lingering = await getExistingSubscription();
        if (lingering) {
          await unregisterPushSubscriptionAction(lingering.endpoint);
        }
      }
      setEnabled(false);
      toast.success("친구 소비 알림을 껐어요.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "알림을 끄지 못했어요.";
      toast.error(message);
    }
  }

  function handleChange(next: boolean) {
    if (disabled) return;
    startTransition(() => {
      void (next ? turnOn() : turnOff());
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor="friend-notifications" className="text-sm font-semibold">
            친구 소비 알림
          </Label>
          <p className="text-xs text-muted-foreground">
            친구가 소비를 추가하면 알림을 받아요. 이름만 보여요.
          </p>
        </div>
        <Switch
          id="friend-notifications"
          checked={enabled}
          onCheckedChange={handleChange}
          disabled={disabled}
        />
      </div>
      {permission === "denied" && (
        <p className="rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          브라우저 알림이 차단돼있어요. 사이트 설정에서 알림을 허용한 후 다시
          시도해주세요.
        </p>
      )}
      {permission === "unsupported" && (
        <p className="rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          현재 브라우저는 푸시 알림을 지원하지 않아요.
        </p>
      )}
      {needsPwaInstall && (
        <p className="rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          iOS에서는 홈 화면에 추가한 뒤 알림을 받을 수 있어요. 공유 버튼 →
          &ldquo;홈 화면에 추가&rdquo;를 눌러주세요.
        </p>
      )}
      {!vapidPublicKey && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-xs text-destructive">
          VAPID 키가 설정되지 않았어요. 운영자에게 문의해주세요.
        </p>
      )}
    </section>
  );
}
