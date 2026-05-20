"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  renameGroupAction,
  setGroupMembershipAction,
} from "@/app/friends/actions";
import type {
  GroupsPageFriend,
  GroupsPageGroup,
} from "@/app/friends/groups/page";
import { FriendMultiPicker } from "@/components/friends/groups/friend-multi-picker";
import { Button } from "@/components/ui/button";
import { BottomSheet, useStableNonNull } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GROUP_NAME_MAX_LENGTH } from "@/lib/utils/group";

type Props = {
  /** Open when non-null; null closes the drawer. */
  target: GroupsPageGroup | null;
  onClose: () => void;
  friends: GroupsPageFriend[];
};

// Sequential save flow: name (if changed) → member adds → member removes.
// We do NOT short-circuit on intermediate failure when the member ops have
// already begun — we let each one report independently so the user sees
// partial-success information instead of guessing what landed. The page
// router.refresh() at the end re-syncs whatever state the server actually
// committed.
export function EditGroupDialog({ target, onClose, friends }: Props) {
  const stableTarget = useStableNonNull(target);
  const router = useRouter();

  const [seededFor, setSeededFor] = useState<string | null>(
    stableTarget?.id ?? null,
  );
  const [name, setName] = useState(stableTarget?.name ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>(
    stableTarget?.currentMemberIds ?? [],
  );
  const [isPending, startTransition] = useTransition();

  // React-recommended "adjusting state when a prop changes" pattern (see
  // bottom-sheet's useStableNonNull). When a fresh target arrives, reseed
  // the form during render; React short-circuits and re-runs with the new
  // state. Avoids the lint rule against setState-in-effect cascades.
  if (target && target.id !== seededFor) {
    setSeededFor(target.id);
    setName(target.name);
    setSelectedIds(target.currentMemberIds);
  }

  if (!stableTarget) return null;

  const trimmed = name.trim();
  const isDirty =
    trimmed !== stableTarget.name ||
    !sameSet(selectedIds, stableTarget.currentMemberIds);
  const canSubmit = trimmed.length > 0 && isDirty && !isPending;

  function handleOpenChange(next: boolean) {
    if (!next) {
      // Drop the seed marker so reopening the same row reseeds from the
      // server snapshot instead of preserving the closed-mid-edit values.
      setSeededFor(null);
      onClose();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !stableTarget) return;
    const groupId = stableTarget.id;
    const nameChanged = trimmed !== stableTarget.name;
    const { added, removed } = diffMembership(
      stableTarget.currentMemberIds,
      selectedIds,
    );

    startTransition(async () => {
      // 1) rename
      if (nameChanged) {
        const r = await renameGroupAction(groupId, trimmed);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
      }

      // 2) membership diff — run adds + removes in parallel for latency, but
      // surface each failure individually. Successful ones still persist; the
      // page refresh below will reflect committed state.
      const opPromises: Promise<{
        userId: string;
        action: "add" | "remove";
        ok: boolean;
        error?: string;
      }>[] = [];
      for (const userId of added) {
        opPromises.push(
          setGroupMembershipAction(groupId, userId, true).then((r) =>
            r.ok
              ? { userId, action: "add" as const, ok: true }
              : { userId, action: "add" as const, ok: false, error: r.error },
          ),
        );
      }
      for (const userId of removed) {
        opPromises.push(
          setGroupMembershipAction(groupId, userId, false).then((r) =>
            r.ok
              ? { userId, action: "remove" as const, ok: true }
              : { userId, action: "remove" as const, ok: false, error: r.error },
          ),
        );
      }
      const results = await Promise.all(opPromises);
      const failures = results.filter((r) => !r.ok);
      if (failures.length > 0) {
        toast.error(`멤버 ${failures.length}건 변경 실패: ${failures[0].error}`);
      } else {
        toast.success("그룹을 저장했어요.");
      }

      router.refresh();
      // Route through handleOpenChange so the seed marker resets — otherwise
      // reopening the same row after save would skip the re-seed and show
      // stale form values from the now-superseded snapshot.
      handleOpenChange(false);
    });
  }

  return (
    <BottomSheet
      open={target !== null}
      onOpenChange={handleOpenChange}
      title="그룹 편집"
      subtitle={stableTarget.isSeed ? "기본 그룹" : undefined}
      description="그룹 이름과 멤버를 편집합니다."
      showCloseButton
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-group-name" className="text-[13px] font-medium">
            그룹 이름
          </Label>
          <Input
            id="edit-group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="그룹 이름"
            maxLength={GROUP_NAME_MAX_LENGTH}
            disabled={isPending}
            inputMode="text"
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">
            최대 {GROUP_NAME_MAX_LENGTH}자
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-[13px] font-medium">
            멤버 ({selectedIds.length}명)
          </Label>
          <FriendMultiPicker
            friends={friends}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            disabled={isPending}
          />
        </div>

        <Button type="submit" disabled={!canSubmit} className="h-12 text-[15px]">
          {isPending ? "저장 중…" : "저장"}
        </Button>
      </form>
    </BottomSheet>
  );
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const x of b) if (!setA.has(x)) return false;
  return true;
}

function diffMembership(
  before: string[],
  after: string[],
): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added: string[] = [];
  const removed: string[] = [];
  for (const id of after) if (!beforeSet.has(id)) added.push(id);
  for (const id of before) if (!afterSet.has(id)) removed.push(id);
  return { added, removed };
}
