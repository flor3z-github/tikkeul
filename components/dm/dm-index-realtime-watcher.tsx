"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Mounted on the DM index page. Subscribes to `dm_messages` INSERTs and
 * triggers a 300ms-debounced `router.refresh()` so the index reflects new
 * threads / new last-message previews / unread counts without a manual
 * reload. RLS already restricts the channel to messages in threads the
 * caller belongs to, so we don't need a client-side filter expression.
 */
export function DmIndexRealtimeWatcher() {
  const router = useRouter();

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

      channel = supabase
        .channel("dm-index")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "dm_messages",
          },
          scheduleRefresh,
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
