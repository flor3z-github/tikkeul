"use client";

import { useState } from "react";

import {
  AddFriendSheet,
  type ActiveFriendCode,
} from "@/components/friends/add-friend-sheet";
import { Button } from "@/components/ui/button";

type Props = {
  initialActiveCode: ActiveFriendCode | null;
};

// Empty-state CTA used when the DM index has zero friends. Opens the same
// AddFriendSheet the dashboard omnibox mounts, so the user can issue / redeem
// a friend code without leaving /dm. AddFriendSheet uses BottomSheetNested
// internally — vaul's nested sheet renders standalone too (no parent
// required), so dropping it in here works without a separate non-nested
// variant.
export function DmEmptyAddFriend({ initialActiveCode }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 rounded-2xl bg-card px-5 py-8 text-center">
      <p className="text-sm text-muted-foreground">아직 친구가 없어요</p>
      <p className="mt-1 text-xs text-muted-foreground/80">
        친구를 추가하면 DM과 소비 화면을 함께 볼 수 있어요.
      </p>
      <Button
        type="button"
        size="lg"
        className="mt-5 w-full"
        onClick={() => setOpen(true)}
      >
        친구 추가
      </Button>
      <AddFriendSheet
        open={open}
        onOpenChange={setOpen}
        initialActive={initialActiveCode}
      />
    </div>
  );
}
