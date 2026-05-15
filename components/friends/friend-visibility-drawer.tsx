"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateFriendVisibilityAction } from "@/app/friends/actions";
import { BottomSheet, useStableNonNull } from "@/components/ui/bottom-sheet";
import { Switch } from "@/components/ui/switch";

export type FriendVisibilityPerms = {
  show_spending_total: boolean;
  show_spending_items: boolean;
  show_fixed_total: boolean;
  show_fixed_items: boolean;
};

type Target = {
  userId: string;
  nickname: string;
  perms: FriendVisibilityPerms;
};

type Props = {
  target: Target | null;
  onClose: () => void;
  /** Called after each successful toggle save. Used to show a transient
   *  confirmation indicator on the friend's row once the drawer closes. */
  onSaved?: () => void;
};

type ToggleKey = keyof FriendVisibilityPerms;

const ROWS: { key: ToggleKey; label: string; helper?: string }[] = [
  { key: "show_spending_total", label: "총 소비 금액" },
  { key: "show_spending_items", label: "소비 내역" },
  { key: "show_fixed_total", label: "고정지출 합계" },
  {
    key: "show_fixed_items",
    label: "고정지출 항목",
    helper: "항목 이름이 친구에게 그대로 보여요.",
  },
];

export function FriendVisibilityDrawer({ target, onClose, onSaved }: Props) {
  const open = target !== null;
  // Retain the previous target so the body keeps rendering while vaul plays
  // the close animation. Without this the inner body would unmount the
  // moment the parent clears `target` and the slide-down would look broken.
  const displayTarget = useStableNonNull(target);

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={displayTarget ? `${displayTarget.nickname}님에게 보여줄 항목` : ""}
      description="친구별 노출 항목 설정 시트입니다. 각 항목을 끄면 친구의 화면에서 해당 블럭이 숨겨져요."
    >
      {displayTarget ? (
        <FriendVisibilityDrawerBody
          key={displayTarget.userId}
          target={displayTarget}
          onSaved={onSaved}
        />
      ) : null}
    </BottomSheet>
  );
}

function FriendVisibilityDrawerBody({
  target,
  onSaved,
}: {
  target: Target;
  onSaved?: () => void;
}) {
  // Local optimistic state. The wrapper above remounts this component (via
  // the `key` on the parent) whenever the target friend changes, so initial
  // state can come straight from props without an effect-driven sync.
  const [perms, setPerms] = useState<FriendVisibilityPerms>(target.perms);
  const [, startTransition] = useTransition();

  function flip(key: ToggleKey, next: boolean) {
    const prev = perms;
    const optimistic = { ...perms, [key]: next };
    setPerms(optimistic);
    // Eager: notify parent synchronously so that if the user closes the
    // drawer before the server action returns, the "saved" flash still
    // fires. On error we surface a toast (and the toggle visually reverts)
    // — the eager flash is best-effort feedback that the user's action
    // was accepted into the queue, matching the optimistic UI for the
    // toggle itself.
    onSaved?.();
    startTransition(async () => {
      const result = await updateFriendVisibilityAction(target.userId, {
        [key]: next,
      });
      if (!result.ok) {
        setPerms(prev);
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <p className="-mt-1 pb-3 text-sm text-muted-foreground">
        각 항목을 끄면 친구의 화면에서 해당 블럭이 숨겨져요.
      </p>
      <ul className="space-y-1 pb-4">
        {ROWS.map((row) => {
          const value = perms[row.key];
          return (
            <li
              key={row.key}
              className="flex items-start justify-between gap-3 rounded-2xl px-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-tight">
                  {row.label}
                </p>
                {row.helper ? (
                  <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                    {row.helper}
                  </p>
                ) : null}
              </div>
              <Switch
                checked={value}
                onCheckedChange={(next) => flip(row.key, next)}
                aria-label={row.label}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
