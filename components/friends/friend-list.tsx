"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { removeFriendAction } from "@/app/friends/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  FriendVisibilityDrawer,
  type FriendVisibilityPerms,
} from "@/components/friends/friend-visibility-drawer";

type Friend = {
  userId: string;
  nickname: string;
  perms: FriendVisibilityPerms;
};

type Props = {
  friends: Friend[];
};

export function FriendList({ friends }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [visibilityTargetId, setVisibilityTargetId] = useState<string | null>(
    null,
  );
  // Track whether the user actually saved anything inside the visibility
  // drawer this session. If they did, flash a green checkmark next to the
  // friend's nickname for ~1.5s after the drawer closes. We can't show the
  // flash while the drawer is open (it covers the list), so we hold the
  // signal and replay it on close.
  const [savedThisSession, setSavedThisSession] = useState(false);
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleRemove(friendUserId: string) {
    setConfirmId(null);
    setPendingId(friendUserId);
    startTransition(async () => {
      const result = await removeFriendAction(friendUserId);
      setPendingId(null);
      if (result.ok) {
        toast.success("친구를 해제했어요.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleVisibilityClose() {
    const targetId = visibilityTargetId;
    setVisibilityTargetId(null);
    if (savedThisSession && targetId) {
      setSavedFlashId(targetId);
    }
    setSavedThisSession(false);
  }

  if (friends.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
        아직 친구가 없어요.
      </div>
    );
  }

  const confirmTarget = friends.find((f) => f.userId === confirmId) ?? null;
  const visibilityTarget =
    friends.find((f) => f.userId === visibilityTargetId) ?? null;

  return (
    <>
      <ul className="space-y-2">
        {friends.map((friend) => (
          <li
            key={friend.userId}
            className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold">
                {friend.nickname}
              </span>
              {savedFlashId === friend.userId ? (
                <SavedFlash
                  key={`flash-${friend.userId}`}
                  onDone={() => setSavedFlashId(null)}
                />
              ) : null}
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${friend.nickname}에게 보여줄 항목`}
                onClick={() => setVisibilityTargetId(friend.userId)}
                className="size-9 rounded-full text-muted-foreground"
              >
                <Settings2 className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${friend.nickname} 친구 해제`}
                disabled={pendingId === friend.userId}
                onClick={() => setConfirmId(friend.userId)}
                className="size-9 rounded-full text-muted-foreground"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <FriendVisibilityDrawer
        target={visibilityTarget}
        onClose={handleVisibilityClose}
        onSaved={() => setSavedThisSession(true)}
      />

      <AlertDialog
        open={confirmTarget != null}
        onOpenChange={(next) => {
          if (!next) setConfirmId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>친구를 해제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              서로의 티끌을 더 이상 볼 수 없게 돼요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() =>
                confirmTarget ? handleRemove(confirmTarget.userId) : null
              }
            >
              해제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Transient "saved" confirmation indicator. The container pops in with a
 * spring overshoot while the check mark draws itself stroke-by-stroke,
 * holds for ~900ms, then fades out before unmount. Total ~1500ms window.
 *
 * The pop and draw keyframes live in app/globals.css so this component is
 * pure JSX. No background fill — the standalone bold green check carries
 * enough weight on the card.
 */
function SavedFlash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "out">("in");
  // Stash onDone in a ref so the timer setup below doesn't reset every time
  // the parent re-renders (which happens after the server action
  // revalidates /friends — a new closure for onDone each render would
  // re-trigger an effect that depends on it and stretch the timeline
  // mid-flight). Updated in its own effect so we don't write to ref.current
  // during render, which our react-hooks lint rule forbids.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    // Total visible window ~1750ms: 350ms entry, ~800ms hold, 350ms exit,
    // 250ms buffer so the exit animation has time to fully render before
    // the component unmounts. Without the buffer the last frames of the
    // exit can be clipped on slower devices and the element "just
    // disappears."
    const exitTimer = setTimeout(() => setPhase("out"), 1150);
    const doneTimer = setTimeout(() => onDoneRef.current(), 1750);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  // Distinct keyframe names per phase guarantee the browser restarts the
  // animation when phase flips (key={phase} on the span also forces a
  // remount). Easing is overshoot back-out for entry to match the entry
  // pop, and ease-out for exit since the keyframe itself already encodes
  // the mirror overshoot at the 40% stop.
  const containerAnimation =
    phase === "in"
      ? "saved-flash-pop 350ms cubic-bezier(0.34,1.56,0.64,1) forwards"
      : "saved-flash-pop-out 350ms cubic-bezier(0.4,0,0.2,1) forwards";
  const pathAnimation =
    phase === "in"
      ? "saved-flash-draw 360ms cubic-bezier(0.65,0,0.45,1) 120ms forwards"
      : "saved-flash-undraw 280ms cubic-bezier(0.65,0,0.45,1) forwards";

  return (
    // key={phase} forces a remount on phase flip so the entry and exit
    // animations are guaranteed to run from their 0% keyframes. Without it
    // the inline `animation` swap is often ignored when the previous
    // animation is held by `forwards` fill mode and the browser sees the
    // element as "already animating."
    // key={phase} forces a remount on phase flip so the entry and exit
    // animations are guaranteed to run from their 0% keyframes. Without it
    // the inline `animation` swap is often ignored when the previous
    // animation is held by `forwards` fill mode and the browser sees the
    // element as "already animating."
    <span
      key={phase}
      role="status"
      aria-label="저장됨"
      className="inline-flex shrink-0 items-center justify-center text-emerald-600"
      style={{ animation: containerAnimation }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        aria-hidden
      >
        <path
          d="M5 12 L10 17 L19 7"
          pathLength={1}
          style={{
            strokeDasharray: 1,
            // Entry starts hidden (offset 1) and draws toward 0.
            // Exit starts drawn (offset 0) and retracts toward 1.
            // Matching the keyframe's `from` value avoids a one-frame snap
            // when the new span mounts mid-animation.
            strokeDashoffset: phase === "in" ? 1 : 0,
            animation: pathAnimation,
          }}
        />
      </svg>
    </span>
  );
}
