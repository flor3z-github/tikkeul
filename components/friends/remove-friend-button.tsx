"use client";

import { useRouter } from "next/navigation";
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

type Props = {
  friendUserId: string;
  nickname: string;
};

// Dedicated destructive button + confirm dialog. After a successful removal
// we navigate the user back to /dashboard — the omnibox sheet will reflect
// the change on next open via the action's revalidatePath("/dashboard").
export function RemoveFriendButton({ friendUserId, nickname }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      const result = await removeFriendAction(friendUserId);
      if (result.ok) {
        toast.success("친구를 해제했어요.");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="h-12 w-full rounded-full text-[15px] font-semibold"
      >
        <Trash2 className="mr-2 size-4" />
        친구 해제
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{nickname}님을 해제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              서로의 티끌을 더 이상 볼 수 없게 돼요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={buttonVariants({ variant: "destructive" })}
            >
              해제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
