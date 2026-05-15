"use client";

import { ChevronDown, Users } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  isOwn: boolean;
  selfNickname: string;
  viewingNickname: string;
  onClick: () => void;
};

// "Currently viewing" indicator + the single entry point to the friend
// omnibox sheet. Self mode = muted chip with a generic label; friend mode =
// accent chip with the friend's nickname (truncated). The chip itself is the
// only friend affordance in the header — no separate Users icon button.
export function FriendChip({
  isOwn,
  selfNickname,
  viewingNickname,
  onClick,
}: Props) {
  const label = isOwn ? "내 티끌" : truncateNickname(viewingNickname || "친구");
  const aria = isOwn
    ? `현재 ${selfNickname} 모드, 탭하여 친구로 전환`
    : `현재 ${viewingNickname} 모드, 탭하여 전환`;

  return (
    <button
      type="button"
      aria-label={aria}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 min-w-[44px] items-center gap-2 rounded-full px-3 text-[13px] font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isOwn
          ? "bg-secondary text-foreground hover:bg-secondary/80"
          : "bg-accent text-accent-foreground hover:bg-accent/80",
      )}
    >
      {isOwn ? (
        <Users className="size-4 text-muted-foreground" aria-hidden />
      ) : (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full bg-accent-foreground"
        />
      )}
      <span className="max-w-[8ch] truncate">{label}</span>
      <ChevronDown
        aria-hidden
        className={cn(
          "-mr-0.5 size-3.5 shrink-0",
          isOwn ? "text-muted-foreground" : "text-accent-foreground/70",
        )}
      />
    </button>
  );
}

function truncateNickname(value: string) {
  // Korean nicknames count as full-width chars; truncate by char count.
  if (value.length <= 8) return value;
  return `${value.slice(0, 8)}…`;
}
