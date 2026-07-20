"use client";

import { useEffect, useState } from "react";

import {
  nextNavScrollState,
  type NavScrollState,
} from "@/lib/utils/nav-collapse";
import { navFreeze } from "@/lib/utils/nav-freeze";

/**
 * Scroll-direction collapse state for the floating bottom nav.
 * - passive window scroll listener, rAF-throttled (one state check per frame)
 * - frozen (any bottom sheet open) → no updates; first event after unfreeze
 *   re-anchors lastY instead of treating the keyboard-induced scroll gap as
 *   a user gesture (see lib/utils/nav-collapse.ts)
 */
export function useNavCollapsed(): boolean {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let state: NavScrollState = { collapsed: false, lastY: window.scrollY };
    let wasFrozen = false;
    let raf = 0;

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const frozen = navFreeze.frozen;
        const next = nextNavScrollState(state, window.scrollY, frozen, {
          resync: wasFrozen && !frozen,
        });
        if (!frozen) wasFrozen = false;
        else wasFrozen = true;
        if (next.collapsed !== state.collapsed) setCollapsed(next.collapsed);
        state = next;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return collapsed;
}
