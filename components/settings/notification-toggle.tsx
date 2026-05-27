"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import {
  registerPushSubscriptionAction,
  unregisterPushSubscriptionAction,
  setFriendSpendingNotificationsAction,
  setTransactionInteractionNotificationsAction,
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

export type NotificationToggleKind = "friend_spending" | "interaction";

type Props = {
  kind: NotificationToggleKind;
  initialEnabled: boolean;
  vapidPublicKey: string;
};

type PermissionState = NotificationPermission | "unsupported";

type PushEnv = {
  permission: PermissionState;
  needsPwaInstall: boolean;
};

const SERVER_ENV: PushEnv = { permission: "default", needsPwaInstall: false };

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
        // Older Safari rejects the query — fall back to manual notify.
      });
  }
  return () => {
    permissionListeners.delete(callback);
    cleanupPermissionStatus?.();
  };
}

const COPY: Record<
  NotificationToggleKind,
  { id: string; title: string; subtitle: string; onMsg: string; offMsg: string }
> = {
  friend_spending: {
    id: "friend-notifications",
    title: "친구 소비 알림",
    subtitle: "친구가 소비를 추가하면 알림을 받아요. 이름만 보여요.",
    onMsg: "친구 소비 알림을 켰어요.",
    offMsg: "친구 소비 알림을 껐어요.",
  },
  interaction: {
    id: "interaction-notifications",
    title: "반응/댓글 알림",
    subtitle:
      "친구가 내 소비에 이모지로 반응하거나 댓글을 남기면 알림을 받아요.",
    onMsg: "반응/댓글 알림을 켰어요.",
    offMsg: "반응/댓글 알림을 껐어요.",
  },
};

async function setFlag(kind: NotificationToggleKind, enabled: boolean) {
  if (kind === "friend_spending") {
    return setFriendSpendingNotificationsAction(enabled);
  }
  return setTransactionInteractionNotificationsAction(enabled);
}

export function NotificationToggle({
  kind,
  initialEnabled,
  vapidPublicKey,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const env = useSyncExternalStore(
    subscribeToPushEnv,
    readPushEnv,
    () => SERVER_ENV,
  );
  const { permission, needsPwaInstall } = env;
  const copy = COPY[kind];

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
      const sub = await subscribeDevice(vapidPublicKey, true);
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
      const toggleResult = await setFlag(kind, true);
      if (!toggleResult.ok) {
        toast.error(toggleResult.error);
        return;
      }
      setEnabled(true);
      toast.success(copy.onMsg);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "알림을 켜지 못했어요.";
      toast.error(message);
    }
  }

  async function turnOff() {
    try {
      const toggleResult = await setFlag(kind, false);
      if (!toggleResult.ok) {
        toast.error(toggleResult.error);
        return;
      }
      // Only tear down the device subscription when neither flag is on. The
      // server returns the freshly-read flag state so we don't race with the
      // other toggle within the same session.
      if (!toggleResult.anyEnabled) {
        const removed = await unsubscribeDevice();
        if (removed) {
          await unregisterPushSubscriptionAction(removed.endpoint);
        } else {
          const lingering = await getExistingSubscription();
          if (lingering) {
            await unregisterPushSubscriptionAction(lingering.endpoint);
          }
        }
      }
      setEnabled(false);
      toast.success(copy.offMsg);
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
          <Label htmlFor={copy.id} className="text-sm font-semibold">
            {copy.title}
          </Label>
          <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
        </div>
        <Switch
          id={copy.id}
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
