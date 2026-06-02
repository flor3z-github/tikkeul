"use client";

import { useEffect, useRef, useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { DrawerClose } from "@/components/ui/drawer";
import { ReleaseNotesList } from "@/components/release-notes/release-notes-list";
import { LONG_PRESS_GUIDE_FLAG } from "@/components/onboarding/long-press-guide";
import { LATEST_RELEASE_VERSION, RELEASE_NOTES } from "@/lib/release-notes";

// Stores the last release version the viewer saw in this popup. Compared
// against LATEST_RELEASE_VERSION on mount; differing → show once.
const LAST_SEEN_KEY = "tikkeul.release_notes.last_seen_version";

/**
 * One-time "what's new" sheet shown on the own-mode dashboard after a version
 * bump. Mounted by the dashboard only when the viewer has at least one
 * transaction (same gate as LongPressGuide), and only opens once the
 * long-press onboarding guide has been dismissed — so the two never stack and
 * brand-new day-one users get the guide, not a changelog they have no context
 * for. Records last-seen on every close path so it never re-fires.
 */
export function ReleaseNotesPopup() {
  const [open, setOpen] = useState(false);
  // Strict-mode double-mount guard (matches LongPressGuide).
  const triggeredOnceRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (triggeredOnceRef.current) return;
    triggeredOnceRef.current = true;
    try {
      if (window.localStorage.getItem(LAST_SEEN_KEY) === LATEST_RELEASE_VERSION)
        return;
      // Don't stack on top of the long-press onboarding guide. The guide
      // writes its flag to "1" on dismiss; until then (brand-new users on
      // their first session) stay silent and let the guide run first.
      if (window.localStorage.getItem(LONG_PRESS_GUIDE_FLAG) !== "1") return;
      // The open decision is gated on localStorage, which can only be read on
      // the client — doing it during render would hydration-mismatch (server
      // always renders closed). So it MUST live in a mount effect, and the one
      // extra render to open is intentional, not the cascading-render
      // anti-pattern the rule targets. (LongPressGuide dodges the rule only
      // because its setOpen sits inside a setTimeout it needs for paint timing;
      // we have no such delay, so an honest disable is clearer than a fake one.)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
    } catch {
      // localStorage blocked (private mode) — skip the popup entirely.
    }
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Record last-seen on EVERY close path (drag-down, overlay tap, X button,
    // the 확인 button) — not just an explicit click — or the popup re-fires
    // forever for users who dismiss by dragging.
    if (!next) {
      try {
        window.localStorage.setItem(LAST_SEEN_KEY, LATEST_RELEASE_VERSION);
      } catch {
        // ignore — popup may reappear next visit; acceptable in private mode.
      }
    }
  }

  const latest = RELEASE_NOTES[0];
  if (!latest) return null;

  return (
    <BottomSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="새 소식"
      description="이번 업데이트 소식"
    >
      <ReleaseNotesList notes={[latest]} />
      <DrawerClose asChild>
        <Button className="mt-6 h-12 w-full rounded-full text-[15px] font-semibold">
          확인했어요
        </Button>
      </DrawerClose>
    </BottomSheet>
  );
}
