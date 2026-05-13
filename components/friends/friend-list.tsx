"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
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

type Friend = {
  userId: string;
  nickname: string;
};

type Props = {
  friends: Friend[];
};

export function FriendList({ friends }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
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

  if (friends.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
        아직 친구가 없어요.
      </div>
    );
  }

  const confirmTarget = friends.find((f) => f.userId === confirmId) ?? null;

  return (
    <>
      <ul className="space-y-2">
        {friends.map((friend) => (
          <li
            key={friend.userId}
            className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
          >
            <span className="text-sm font-semibold">{friend.nickname}</span>
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
          </li>
        ))}
      </ul>

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
