"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Live-refresh the dashboard when the data source we're viewing changes.
 *
 * Two modes:
 *
 * - **Friend mode** (`isOwn=false`): watches the friend's `transactions`,
 *   plus `transaction_reactions` and `transaction_comments` for any
 *   transaction owned by that friend. This is how a viewer sees a friend
 *   add/remove transactions in real time, and how they see others react /
 *   comment on those transactions live.
 *
 * - **Own mode** (`isOwn=true`): only watches incoming reactions/comments on
 *   the viewer's own transactions. Own `transactions` are not subscribed —
 *   own mutations already revalidate locally via the server action.
 *
 * The two interaction tables denormalize `transaction_owner_id` so we can
 * filter without a join (see migration 0034).
 */
type Props = {
  /** The transaction-owner whose reactions/comments we're watching. */
  ownerUserId: string;
  /** True when ownerUserId === viewer. Skips the transactions subscription. */
  isOwn: boolean;
};

export function FriendRealtimeWatcher({ ownerUserId, isOwn }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const schedule = () => {
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

      const channelName = isOwn
        ? `own-interactions:${ownerUserId}`
        : `friend-tx:${ownerUserId}`;
      let builder = supabase.channel(channelName);

      if (!isOwn) {
        builder = builder.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${ownerUserId}`,
          },
          schedule,
        );
      }

      builder = builder
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transaction_reactions",
            filter: `transaction_owner_id=eq.${ownerUserId}`,
          },
          schedule,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transaction_comments",
            filter: `transaction_owner_id=eq.${ownerUserId}`,
          },
          schedule,
        );

      channel = builder.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[realtime] subscribe status:", status);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [ownerUserId, isOwn, router]);

  return null;
}
