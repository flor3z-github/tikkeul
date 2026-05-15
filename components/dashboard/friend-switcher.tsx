"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Check, Users } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FriendOption = {
  userId: string;
  nickname: string;
};

type Props = {
  selfNickname: string;
  viewerUserId: string;
  friends: FriendOption[];
  currentViewingUserId: string;
};

export function FriendSwitcher({
  selfNickname,
  viewerUserId,
  friends,
  currentViewingUserId,
}: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(viewing: string | null) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (viewing && viewing !== viewerUserId) {
      params.set("viewing", viewing);
    } else {
      params.delete("viewing");
    }
    // Reset the cycle on every viewer switch so the dashboard always opens
    // on the current month/cycle rather than carrying the previous viewer's.
    params.delete("ym");
    params.delete("day");
    const qs = params.toString();
    router.push(qs ? `/dashboard?${qs}` : "/dashboard");
    setOpen(false);
  }

  const items: FriendOption[] = [
    { userId: viewerUserId, nickname: `${selfNickname} (나)` },
    ...friends,
  ];

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="친구 전환"
        onClick={() => setOpen(true)}
        className="rounded-full text-muted-foreground"
      >
        <Users className="size-5" />
      </Button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="티끌 보기"
        description="친구 전환 시트입니다. 볼 사람을 골라 대시보드 보기를 전환합니다."
      >
        <p className="-mt-1 pb-3 text-sm text-muted-foreground">
          볼 사람을 골라주세요.
        </p>

        <ul className="space-y-1">
          {items.map((item) => {
            const selected = item.userId === currentViewingUserId;
            return (
              <li key={item.userId}>
                <button
                  type="button"
                  onClick={() => navigate(item.userId)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left",
                    selected ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <span className="text-[15px] font-medium">
                    {item.nickname}
                  </span>
                  {selected ? <Check className="size-4" /> : null}
                </button>
              </li>
            );
          })}
        </ul>

        {friends.length === 0 ? (
          <Link
            href="/friends"
            prefetch
            onClick={() => setOpen(false)}
            className="mt-4 block rounded-2xl border border-dashed border-border bg-card/50 px-4 py-4 text-center text-sm text-muted-foreground"
          >
            친구 코드로 친구를 추가해보세요 →
          </Link>
        ) : (
          <Link
            href="/friends"
            prefetch
            onClick={() => setOpen(false)}
            className="mt-4 block rounded-2xl px-4 py-3 text-center text-xs text-muted-foreground hover:bg-muted/40"
          >
            친구 관리 →
          </Link>
        )}
      </BottomSheet>
    </>
  );
}
