"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { setCloseFriendAction } from "@/app/friends/actions";
import { Switch } from "@/components/ui/switch";

type CloseFriendToggleProps = {
  friendUserId: string;
  initialIsClose: boolean;
};

export function CloseFriendToggle({
  friendUserId,
  initialIsClose,
}: CloseFriendToggleProps) {
  const [isClose, setIsClose] = useState(initialIsClose);
  const [, startTransition] = useTransition();

  function handleChange(next: boolean) {
    const prev = isClose;
    setIsClose(next);
    startTransition(async () => {
      const result = await setCloseFriendAction(friendUserId, next);
      if (!result.ok) {
        setIsClose(prev);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Star
          className={`mt-0.5 size-4 shrink-0 ${
            isClose ? "fill-primary text-primary" : "text-muted-foreground"
          }`}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[15px] font-medium leading-tight">친한 친구</p>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            소비 추가 시 &quot;친한 친구만&quot; 공개 범위를 고르면 이 친구에게만
            보여요. 친구는 자기가 친한 친구로 지정됐는지 알 수 없어요.
          </p>
        </div>
      </div>
      <Switch
        checked={isClose}
        onCheckedChange={handleChange}
        aria-label="친한 친구"
      />
    </div>
  );
}
