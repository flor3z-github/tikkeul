"use client";

import {
  FriendVisibilityToggles,
  type FriendVisibilityPerms,
} from "@/components/friends/friend-visibility-toggles";
import { RemoveFriendButton } from "@/components/friends/remove-friend-button";
import {
  BottomSheetNested,
  useStableNonNull,
} from "@/components/ui/bottom-sheet";

export type FriendVisibilityTarget = {
  userId: string;
  nickname: string;
  perms: FriendVisibilityPerms;
};

type Props = {
  target: FriendVisibilityTarget | null;
  onClose: () => void;
};

// Nested sheet that hosts the per-friend visibility toggles + the destructive
// remove action. Mounted on top of the friends omnibox so closing it returns
// the user straight to the friend list. Use `useStableNonNull` so the body
// keeps rendering during vaul's slide-down even after the parent clears the
// target.
export function FriendVisibilitySheet({ target, onClose }: Props) {
  const open = target !== null;
  const stable = useStableNonNull(target);

  return (
    <BottomSheetNested
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={stable ? `${stable.nickname}님에게 보여줄 항목` : ""}
      description="친구별 노출 항목 시트입니다. 각 항목을 끄면 친구의 화면에서 해당 블럭이 숨겨져요."
    >
      {stable ? (
        <div key={stable.userId} className="space-y-4 pb-2">
          <p className="-mt-1 text-[12.5px] leading-snug text-muted-foreground">
            수입과 가용 예산은 어떤 설정에서도 공개되지 않아요.
          </p>
          <FriendVisibilityToggles
            friendUserId={stable.userId}
            initialPerms={stable.perms}
          />
          <RemoveFriendButton
            friendUserId={stable.userId}
            nickname={stable.nickname}
          />
        </div>
      ) : null}
    </BottomSheetNested>
  );
}
