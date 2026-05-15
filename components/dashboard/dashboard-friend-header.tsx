"use client";

import { useState } from "react";

import { FriendChip } from "@/components/dashboard/friend-chip";
import {
  FriendOmniboxSheet,
  type FriendOption,
} from "@/components/dashboard/friend-omnibox-sheet";
import type { ActiveFriendCode } from "@/components/friends/add-friend-sheet";

type Props = {
  isOwn: boolean;
  selfNickname: string;
  viewerUserId: string;
  friends: FriendOption[];
  currentViewingUserId: string;
  viewingNickname: string;
  initialActiveCode: ActiveFriendCode | null;
};

// Thin client wrapper: owns the omnibox open state so the dashboard page can
// stay a server component. The chip is the single header affordance for any
// friend-related action.
export function DashboardFriendHeader({
  isOwn,
  selfNickname,
  viewerUserId,
  friends,
  currentViewingUserId,
  viewingNickname,
  initialActiveCode,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <FriendChip
        isOwn={isOwn}
        selfNickname={selfNickname}
        viewingNickname={viewingNickname}
        onClick={() => setOpen(true)}
      />
      <FriendOmniboxSheet
        open={open}
        onOpenChange={setOpen}
        selfNickname={selfNickname}
        viewerUserId={viewerUserId}
        friends={friends}
        currentViewingUserId={currentViewingUserId}
        initialActiveCode={initialActiveCode}
      />
    </>
  );
}
