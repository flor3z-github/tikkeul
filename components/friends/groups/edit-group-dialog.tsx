"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteGroupAction,
  previewDeleteGroupAction,
  renameGroupAction,
  setGroupMembershipAction,
} from "@/app/friends/actions";
import type {
  GroupsPageFriend,
  GroupsPageGroup,
} from "@/app/friends/groups/page";
import { FriendMultiPicker } from "@/components/friends/groups/friend-multi-picker";
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
import { BottomSheet, useStableNonNull } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GROUP_NAME_MAX_LENGTH } from "@/lib/utils/group";
import { cn } from "@/lib/utils";

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

  // Delete flow state. orphanCount=null means the preview hasn't loaded yet
  // (or the dialog hasn't been opened). isDeleting governs the AlertDialog
  // action button; isPreviewing governs the destructive button in the form.
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [orphanCount, setOrphanCount] = useState<number | null>(null);
  const [isPreviewing, startPreviewTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

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

        {/* Delete affordance — hidden for the seed group. RLS also blocks
            seed deletion (slug is null required), but hiding the button
            keeps the UI honest. */}
        {!stableTarget.isSeed ? (
          <Button
            type="button"
            variant="ghost"
            disabled={isPending || isPreviewing || isDeleting}
            onClick={openDeleteConfirm}
            className="mt-2 h-11 text-[14px] text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
            {isPreviewing ? "확인 중…" : "그룹 삭제"}
          </Button>
        ) : null}
      </form>

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={(next) => {
          if (!isDeleting) setConfirmDeleteOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 그룹을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {orphanCount && orphanCount > 0
                ? `이 그룹에만 공개된 거래 ${orphanCount}건이 비공개로 전환돼요. 다른 그룹과 함께 공개된 거래는 그대로 유지돼요.`
                : "삭제해도 다른 그룹·거래에는 영향이 없어요."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className={cn(
                buttonVariants({ variant: "destructive" }),
                "h-12 w-full rounded-full text-[15px] font-semibold",
              )}
            >
              {isDeleting ? "삭제 중…" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BottomSheet>
  );

  function openDeleteConfirm() {
    if (!stableTarget) return;
    const groupId = stableTarget.id;
    // Preview first so we can include the orphan count in the confirm copy.
    // Surface the dialog regardless of preview success — if the preview
    // errors we still want to let the user proceed and surface the failure
    // there rather than swallowing the intent.
    startPreviewTransition(async () => {
      const result = await previewDeleteGroupAction(groupId);
      setOrphanCount(result.ok ? result.orphanCount : 0);
      setConfirmDeleteOpen(true);
    });
  }

  function handleDelete() {
    if (!stableTarget) return;
    const groupId = stableTarget.id;
    startDeleteTransition(async () => {
      const result = await deleteGroupAction(groupId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("그룹을 삭제했어요.");
      setConfirmDeleteOpen(false);
      setOrphanCount(null);
      router.refresh();
      handleOpenChange(false);
    });
  }
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
