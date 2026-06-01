"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

/**
 * Live-refresh the dashboard when the data source we're viewing changes.
 *
 * - **Friend mode** (`isOwn=false`): watches the friend's `transactions` so a
 *   viewer sees the friend add/remove transactions in real time.
 *
 * - **Own mode** (`isOwn=true`): watches `dm_messages` for incoming DMs and
 *   surfaces a sonner toast with a "DM 열기" action that deep-links into the
 *   thread. We don't filter the postgres_changes channel: every authenticated
 *   user is only a member of their own threads so RLS already restricts the
 *   delivered events. Self-sent messages are filtered out client-side so the
 *   owner doesn't get toasted for their own replies. Same handler also kicks
 *   a debounced `router.refresh()` so the header MessageCircle unread dot
 *   stays in sync without waiting for a manual reload.
 *
 *   Own-mode does NOT subscribe to `transactions` — own mutations revalidate
 *   locally via the server action, so a second channel would just produce
 *   redundant refreshes.
 */
type Props = {
  /** The transaction-owner we're viewing. */
  ownerUserId: string;
  /** True when ownerUserId === viewer. Toggles the own-mode subscription. */
  isOwn: boolean;
  /** Display-name lookup, used to label own-mode toasts. Optional — falls
   *  back to "친구" if the sender isn't in the map. */
  nicknameById?: Map<string, string>;
};

const TOAST_PREVIEW_LIMIT = 30;

export function FriendRealtimeWatcher({
  ownerUserId,
  isOwn,
  nicknameById,
}: Props) {
  const router = useRouter();

  // Keep the latest nickname map in a ref so the realtime effect doesn't
  // re-subscribe on every dashboard refresh — the parent re-creates this Map
  // each RSC render, so it changes identity. The INSERT handler reads the ref.
  const nicknameByIdRef = useRef(nicknameById);
  useEffect(() => {
    nicknameByIdRef.current = nicknameById;
  }, [nicknameById]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };

    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) {
        await supabase.realtime.setAuth(accessToken);
      }
      if (cancelled) return;

      if (isOwn) {
        channel = supabase
          .channel(`own-dm:${ownerUserId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "dm_messages",
            },
            (payload) => {
              const row = payload.new as {
                sender_id: string;
                content: string;
              } | null;
              if (!row || row.sender_id === ownerUserId) return;
              const nickname =
                nicknameByIdRef.current?.get(row.sender_id) ?? "친구";
              const trimmed = row.content.trim();
              const preview =
                trimmed.length > TOAST_PREVIEW_LIMIT
                  ? `${trimmed.slice(0, TOAST_PREVIEW_LIMIT)}…`
                  : trimmed;
              toast(`${nickname}: ${preview}`, {
                action: {
                  label: "DM 열기",
                  onClick: () => router.push(`/dm/${row.sender_id}`),
                },
              });
              // Bump the unread dot on the header MessageCircle by
              // re-rendering the dashboard. Debounced so a burst of incoming
              // messages collapses into one refresh.
              scheduleRefresh();
            },
          )
          .subscribe();
      } else {
        channel = supabase
          .channel(`friend-tx:${ownerUserId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "transactions",
              filter: `user_id=eq.${ownerUserId}`,
            },
            scheduleRefresh,
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              console.warn("[realtime] subscribe status:", status);
            }
          });
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [ownerUserId, isOwn, router]);

  return null;
}
