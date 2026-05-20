"use client";

import { Plus, Users } from "lucide-react";

import type { GroupsPageGroup } from "@/app/friends/groups/page";
import { cn } from "@/lib/utils";

type Props = {
  groups: GroupsPageGroup[];
};

export function GroupsPage({ groups }: Props) {
  // 3a is read-only — create/edit handlers ship in 3b/3c. Until then the
  // row and FAB are visually present but disabled so the surface area is
  // testable without dead behavior.
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
              <GroupRow group={g} />
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled
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
        그룹은 최대 10개까지 만들 수 있어요.
      </p>
    </div>
  );
}

function GroupRow({ group }: { group: GroupsPageGroup }) {
  const preview =
    group.previewMemberNicknames.length === 0
      ? "멤버 없음"
      : group.memberCount > group.previewMemberNicknames.length
        ? `${group.previewMemberNicknames.join(", ")} 외 ${group.memberCount - group.previewMemberNicknames.length}명`
        : group.previewMemberNicknames.join(", ");

  return (
    <button
      type="button"
      disabled
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-left transition-colors",
        "hover:bg-muted",
        "disabled:cursor-default disabled:hover:bg-card",
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
