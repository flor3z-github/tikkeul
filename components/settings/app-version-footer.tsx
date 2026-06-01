"use client";

import { useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ReleaseNotesList } from "@/components/release-notes/release-notes-list";
import { LATEST_RELEASE_VERSION, RELEASE_NOTES } from "@/lib/release-notes";

/**
 * Settings footer showing the app version. Tapping it opens the full release
 * history ("새 소식") in a bottom sheet — the always-available counterpart to
 * the dashboard's one-time version-bump popup.
 */
export function AppVersionFooter() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mt-8 pb-2 text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          티끌 v{LATEST_RELEASE_VERSION} · 새 소식
        </button>
      </div>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="새 소식"
        description="티끌의 버전별 업데이트 내역"
        contentClassName="h-[85dvh]"
      >
        <ReleaseNotesList notes={RELEASE_NOTES} />
      </BottomSheet>
    </>
  );
}
