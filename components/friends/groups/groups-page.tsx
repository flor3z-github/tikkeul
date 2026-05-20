"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";

import type {
  GroupsPageFriend,
  GroupsPageGroup,
} from "@/app/friends/groups/page";
import { CreateGroupDialog } from "@/components/friends/groups/create-group-dialog";
import { EditGroupDialog } from "@/components/friends/groups/edit-group-dialog";
import { cn } from "@/lib/utils";

type Props = {
  groups: GroupsPageGroup[];
  friends: GroupsPageFriend[];
};

export function GroupsPage({ groups, friends }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<GroupsPageGroup | null>(null);

  // Cap-aware: the create button stays clickable until the 10-group limit is
  // reached. The 0044 trigger also enforces this server-side; the disabled
  // state is just a UX courtesy.
  const atCap = groups.length >= 10;

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <p className="rounded-2xl bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
          아직 그룹이 없어요.
        </p>
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.id}>
              <GroupRow group={g} onClick={() => setEditTarget(g)} />
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        disabled={atCap}
        className={cn(
          "mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground",
          "disabled:opacity-50",
        )}
        aria-label="새 그룹 만들기"
      >
        <Plus className="size-4" aria-hidden />
        새 그룹 만들기
      </button>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        {atCap
          ? "그룹은 최대 10개예요. 기존 그룹을 정리한 후 다시 만들어 보세요."
          : "그룹은 최대 10개까지 만들 수 있어요."}
      </p>

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        friends={friends}
      />
      <EditGroupDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        friends={friends}
      />
    </div>
  );
}

function GroupRow({
  group,
  onClick,
}: {
  group: GroupsPageGroup;
  onClick: () => void;
}) {
  const preview =
    group.previewMemberNicknames.length === 0
      ? "친구 없음"
      : group.memberCount > group.previewMemberNicknames.length
        ? `${group.previewMemberNicknames.join(", ")} 외 ${group.memberCount - group.previewMemberNicknames.length}명`
        : group.previewMemberNicknames.join(", ");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-left transition-colors",
        "hover:bg-muted",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold">
            {group.name}
          </span>
          {group.isSeed ? (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              기본
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
          {preview}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 text-[12px] text-muted-foreground">
        <Users className="size-3.5" aria-hidden />
        <span>{group.memberCount}명</span>
      </div>
    </button>
  );
}
