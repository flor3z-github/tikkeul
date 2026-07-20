"use client";

import { useEffect } from "react";

// iOS standalone PWA quirk: focusing a text input makes WebKit pan the layout
// viewport so the input is visible (`visualViewport.offsetTop` goes positive —
// quirk #2 in components/ui/drawer.tsx). When the keyboard dismisses, WebKit
// sometimes fails to undo that pan, leaving the whole app rendered shifted up:
// content under the status bar, `position: fixed` surfaces (BottomTabNav, FAB)
// stranded mid-screen, and a dead strip at the physical bottom. The state is
// invisible to layout code — no resize/reflow fires — and only clears when the
// user happens to scroll.
//
// Fix: mounted once in the root layout, this component watches for the
// keyboard closing (visualViewport resize / focusout) and, if a residual pan
// remains afterwards, performs a same-position scroll nudge, which forces
// WebKit to re-sync the visual viewport against the layout viewport without
// losing the user's scroll position. Sheet-local keyboard handling
// (DrawerContent, dm-chat) is unaffected — this only ever runs once the
// keyboard is gone and no editable element holds focus.
export function KeyboardViewportRestore() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // Same threshold as DrawerContent: Mobile Safari's URL bar shrinks the
    // visualViewport by ~50–80px during ordinary scrolling; only a larger
    // shrink means the keyboard is (still) up.
    const KEYBOARD_THRESHOLD_PX = 100;
    // Sub-pixel/rounding jitter in offsetTop that never indicates a stuck pan.
    const PAN_EPSILON_PX = 2;

    let timers: number[] = [];

    const isEditable = (el: Element | null): boolean =>
      el instanceof HTMLElement &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable);

    function restoreIfStuck() {
      const keyboardHeight = window.innerHeight - vv!.height;
      // Keyboard still up (or mid-animation) — the pan is legitimate.
      if (keyboardHeight > KEYBOARD_THRESHOLD_PX) return;
      // An editable element regained focus (e.g. the DM composer keeps focus
      // across sends) — leave the viewport to the focused surface's handler.
      if (isEditable(document.activeElement)) return;
      if (vv!.offsetTop <= PAN_EPSILON_PX) return;
      // Same-position nudge: the +1/back pair guarantees a real scroll event
      // even when scrollTo with an identical position would be a no-op, and
      // clamping makes it safe at the document edges.
      const x = window.scrollX;
      const y = window.scrollY;
      window.scrollTo(x, y + 1);
      window.scrollTo(x, y);
    }

    // The dismiss animation moves vv.height/offsetTop over several frames and
    // the final values often land after the last resize event, so check on a
    // trailing schedule instead of once (same pattern as DrawerContent's
    // focus handler).
    function scheduleRestore() {
      for (const t of timers) window.clearTimeout(t);
      timers = [];
      requestAnimationFrame(restoreIfStuck);
      for (const delay of [150, 400, 800]) {
        timers.push(window.setTimeout(restoreIfStuck, delay));
      }
    }

    vv.addEventListener("resize", scheduleRestore);
    window.addEventListener("focusout", scheduleRestore);
    return () => {
      for (const t of timers) window.clearTimeout(t);
      vv.removeEventListener("resize", scheduleRestore);
      window.removeEventListener("focusout", scheduleRestore);
    };
  }, []);

  return null;
}
