"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createGroupAction } from "@/app/friends/actions";
import type { GroupsPageFriend } from "@/app/friends/groups/page";
import { FriendMultiPicker } from "@/components/friends/groups/friend-multi-picker";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GROUP_NAME_MAX_LENGTH } from "@/lib/utils/group";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  friends: GroupsPageFriend[];
};

export function CreateGroupDialog({ open, onOpenChange, friends }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !isPending;

  function handleOpenChange(next: boolean) {
    // Reset between sessions so a half-typed name / partial selection doesn't
    // survive the next open. Only reset on close; opening just propagates.
    if (!next) {
      setName("");
      setSelectedIds([]);
    }
    onOpenChange(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await createGroupAction(trimmed, selectedIds);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("그룹을 만들었어요.");
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="새 그룹 만들기"
      description="새 친구 그룹을 만들고 멤버를 지정합니다."
      showCloseButton
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="group-name" className="text-[13px] font-medium">
            그룹 이름
          </Label>
          <Input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 가족, 회사 동료"
            maxLength={GROUP_NAME_MAX_LENGTH}
            disabled={isPending}
            autoFocus
            inputMode="text"
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            최대 {GROUP_NAME_MAX_LENGTH}자
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-[13px] font-medium">
              멤버 ({selectedIds.length}명)
            </Label>
            <span className="text-[11px] text-muted-foreground">
              나중에 추가/제거할 수 있어요
            </span>
          </div>
          <FriendMultiPicker
            friends={friends}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            disabled={isPending}
            emptyState="멤버로 추가할 친구가 없어요. 그룹은 빈 상태로 만들 수 있어요."
          />
        </div>

        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={!canSubmit} className="h-12 text-[15px]">
            {isPending ? "만드는 중…" : "그룹 만들기"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
