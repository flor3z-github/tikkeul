"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { setGroupMembershipAction } from "@/app/friends/actions";
import { Switch } from "@/components/ui/switch";

export type GroupMembershipRow = {
  groupId: string;
  name: string;
  isSeed: boolean;
  isMember: boolean;
};

type Props = {
  friendUserId: string;
  groups: GroupMembershipRow[];
};

export function GroupMembershipList({ friendUserId, groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-5 text-center text-[13px] text-muted-foreground">
        <p>아직 그룹이 없어요.</p>
        <Link
          href="/friends/groups"
          className="mt-2 inline-flex items-center gap-1 text-foreground hover:underline"
        >
          <Plus className="size-3.5" aria-hidden />
          그룹 만들기
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {groups.map((g) => (
        <li key={g.groupId}>
          <GroupRow friendUserId={friendUserId} row={g} />
        </li>
      ))}
    </ul>
  );
}

function GroupRow({
  friendUserId,
  row,
}: {
  friendUserId: string;
  row: GroupMembershipRow;
}) {
  const [isMember, setIsMember] = useState(row.isMember);
  const [, startTransition] = useTransition();

  function handleChange(next: boolean) {
    const prev = isMember;
    // Optimistic flip. The server action revalidates /friends and
    // /dashboard; a router.refresh isn't needed here because the parent
    // page is the source of truth for `row.isMember` only on initial
    // render — subsequent state lives in this row's useState.
    setIsMember(next);
    startTransition(async () => {
      const result = await setGroupMembershipAction(
        row.groupId,
        friendUserId,
        next,
      );
      if (!result.ok) {
        setIsMember(prev);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <p className="truncate text-[15px] font-medium">{row.name}</p>
        {row.isSeed ? (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
            기본
          </span>
        ) : null}
      </div>
      <Switch
        checked={isMember}
        onCheckedChange={handleChange}
        aria-label={`${row.name} 그룹`}
      />
    </div>
  );
}
