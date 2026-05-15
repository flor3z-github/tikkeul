"use client";

import { useEffect, useState } from "react";

import { FriendCodeIssueCard } from "@/components/friends/friend-code-issue-card";
import { FriendCodeRedeemForm } from "@/components/friends/friend-code-redeem-form";
import { BottomSheetNested } from "@/components/ui/bottom-sheet";

export type ActiveFriendCode = {
  code: string;
  expiresAt: string;
};

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  initialActive: ActiveFriendCode | null;
};

// Nested sheet that hosts the issue/redeem flow on top of the friends
// omnibox. The two inner components manage their own local + transition
// state, so all this wrapper does is mount them inside `BottomSheetNested`.
//
// Why nested instead of replacing the omnibox: keeping the omnibox mounted
// means closing this sheet returns the user straight to the friend list with
// the new friend already visible (the redeem action revalidates /dashboard,
// which RSC re-renders the omnibox props).
export function AddFriendSheet({ open, onOpenChange, initialActive }: Props) {
  // The body should fully reset between sheet sessions — `key` remounts the
  // children when the sheet closes so a half-typed code or expired timer
  // doesn't survive the next open. We only flip the key when the sheet has
  // finished closing to avoid disturbing the live body during the slide-down.
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => setResetKey((k) => k + 1), 320);
      return () => clearTimeout(id);
    }
  }, [open]);

  return (
    <BottomSheetNested
      open={open}
      onOpenChange={onOpenChange}
      title="친구 추가"
      description="친구 코드 발급 또는 입력 시트입니다."
      showCloseButton
    >
      <div key={resetKey} className="space-y-3 pb-2">
        <FriendCodeIssueCard initialActive={initialActive} />
        <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
          <span aria-hidden className="h-px flex-1 bg-border" />
          또는 입력
          <span aria-hidden className="h-px flex-1 bg-border" />
        </div>
        <FriendCodeRedeemForm />
      </div>
    </BottomSheetNested>
  );
}
