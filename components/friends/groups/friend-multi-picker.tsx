"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";

import type { GroupsPageFriend } from "@/app/friends/groups/page";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  friends: GroupsPageFriend[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  /** Disable interactions during a pending mutation. */
  disabled?: boolean;
  /** Optional copy for the empty state when the viewer has no friends yet. */
  emptyState?: string;
};

// Friend multi-select used by the group create/edit drawers (3b/3c) and the
// future transaction form group picker (step 6). Built as a tappable row with
// a Check icon — matches the existing omnibox / FriendRow pattern, no extra
// dependency on a shadcn Checkbox primitive.
export function FriendMultiPicker({
  friends,
  selectedIds,
  onChange,
  disabled = false,
  emptyState = "아직 친구가 없어요.",
}: Props) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.nickname.toLowerCase().includes(q));
  }, [friends, deferredQuery]);

  function toggle(userId: string) {
    if (disabled) return;
    if (selectedSet.has(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  }

  if (friends.length === 0) {
    return (
      <p className="rounded-2xl bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
        {emptyState}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="친구 닉네임 검색"
          className="h-11 rounded-full bg-muted pl-9 text-[14px]"
          aria-label="친구 닉네임 검색"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl bg-card/50 px-4 py-4 text-center text-[13px] text-muted-foreground">
          검색 결과가 없어요.
        </p>
      ) : (
        <ul className="space-y-1">
          {filtered.map((f) => {
            const checked = selectedSet.has(f.userId);
            return (
              <li key={f.userId}>
                <button
                  type="button"
                  onClick={() => toggle(f.userId)}
                  disabled={disabled}
                  aria-pressed={checked}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors",
                    checked ? "bg-secondary" : "hover:bg-muted",
                    disabled && "opacity-50",
                  )}
                >
                  <span className="truncate text-[15px] font-medium">
                    {f.nickname}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {checked ? <Check className="size-3.5" /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
