"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresh the current route when the page is restored from the back/forward
 * cache or the app returns to the foreground.
 *
 * Why this exists: DM read state (`dm_threads.last_read_at_user_*`, set by the
 * `mark_dm_thread_read` RPC) drives the `/dm` index unread badge and the
 * dashboard header unread dot, both computed server-side from `get_my_dm_index`.
 * Those values never refresh on read because (1) the realtime watchers only
 * subscribe to `dm_messages` INSERTs — read is a `dm_threads` UPDATE, and that
 * table isn't even in the `supabase_realtime` publication — and (2) iOS PWA
 * swipe-back restores the page from bfcache (a DOM snapshot), bypassing the
 * Next router entirely, so the stale badge/dot survives. The Router Cache
 * `staleTimes.dynamic: 30` adds the same staleness to ordinary in-app backs.
 *
 * `router.refresh()` ignores the Router Cache and re-runs the RSC, so the
 * unread count recomputes. We trigger it on:
 *   - `pageshow` with `event.persisted` — the bfcache-restore path (swipe back).
 *   - `visibilitychange` → visible — app foreground / tab return.
 *
 * Renders nothing. Mount on the `/dm` index and the own-mode dashboard.
 */
export function RefreshOnRestore() {
  const router = useRouter();

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) router.refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}
