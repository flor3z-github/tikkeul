"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowLeftCircle, Check, Plus, Search, Settings2 } from "lucide-react";

import {
  AddFriendSheet,
  type ActiveFriendCode,
} from "@/components/friends/add-friend-sheet";
import {
  FriendVisibilitySheet,
  type FriendVisibilityTarget,
} from "@/components/friends/friend-visibility-sheet";
import type { FriendVisibilityPerms } from "@/components/friends/friend-visibility-toggles";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FriendOption = {
  userId: string;
  nickname: string;
  perms: FriendVisibilityPerms;
};

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  selfNickname: string;
  viewerUserId: string;
  friends: FriendOption[];
  currentViewingUserId: string;
  initialActiveCode: ActiveFriendCode | null;
};

export function FriendOmniboxSheet({
  open,
  onOpenChange,
  selfNickname,
  viewerUserId,
  friends,
  currentViewingUserId,
  initialActiveCode,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [addOpen, setAddOpen] = useState(false);
  const [visibilityTarget, setVisibilityTarget] =
    useState<FriendVisibilityTarget | null>(null);

  const isOwnView = currentViewingUserId === viewerUserId;

  function navigate(viewing: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (viewing && viewing !== viewerUserId) {
      params.set("viewing", viewing);
    } else {
      params.delete("viewing");
    }
    // Reset cycle params so the dashboard always opens on the current cycle
    // for whoever the new viewer is.
    params.delete("ym");
    params.delete("day");
    const qs = params.toString();
    router.push(qs ? `/dashboard?${qs}` : "/dashboard");
    onOpenChange(false);
  }

  const filteredFriends = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.nickname.toLowerCase().includes(q));
  }, [friends, deferredQuery]);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="친구 보기"
      description="친구 검색·전환·추가 시트입니다. 자기 자신을 고르면 내 티끌로 돌아가요."
    >
      <div className="flex flex-col gap-3 pb-3">
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
          />
        </div>

        <ul className="space-y-1">
          <SelfRow
            nickname={selfNickname}
            selected={isOwnView}
            isFriendMode={!isOwnView}
            onClick={() => navigate(viewerUserId)}
          />

          {filteredFriends.length === 0 ? (
            <li className="rounded-2xl bg-card/50 px-4 py-4 text-center text-[13px] text-muted-foreground">
              {friends.length === 0
                ? "아직 친구가 없어요"
                : "검색 결과가 없어요"}
            </li>
          ) : (
            filteredFriends.map((f) => (
              <FriendRow
                key={f.userId}
                friend={f}
                selected={f.userId === currentViewingUserId}
                onSelect={() => navigate(f.userId)}
                onOpenVisibility={() => setVisibilityTarget(f)}
              />
            ))
          )}
        </ul>

        {/* Sticky add-friend affordance. Opens a nested sheet so the omnibox
            stays mounted underneath — closing the nested sheet returns the
            user straight to the (now refreshed) friend list. */}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground"
        >
          <Plus className="size-4" />
          친구 추가
        </button>
      </div>

      <AddFriendSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        initialActive={initialActiveCode}
      />
      <FriendVisibilitySheet
        target={visibilityTarget}
        onClose={() => setVisibilityTarget(null)}
      />
    </BottomSheet>
  );
}

function SelfRow({
  nickname,
  selected,
  isFriendMode,
  onClick,
}: {
  nickname: string;
  selected: boolean;
  isFriendMode: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors",
          selected ? "bg-secondary" : "hover:bg-muted",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 text-[15px] font-medium">
          <span className="truncate">{nickname}</span>
          <span className="shrink-0 text-[12px] font-normal text-muted-foreground">
            (나)
          </span>
        </span>
        {selected ? (
          <Check className="size-4 text-muted-foreground" aria-hidden />
        ) : isFriendMode ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
            <ArrowLeftCircle className="size-4" aria-hidden />
            내 티끌로
          </span>
        ) : null}
      </button>
    </li>
  );
}

function FriendRow({
  friend,
  selected,
  onSelect,
  onOpenVisibility,
}: {
  friend: FriendOption;
  selected: boolean;
  onSelect: () => void;
  onOpenVisibility: () => void;
}) {
  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex flex-1 items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors",
          selected ? "bg-secondary" : "hover:bg-muted",
        )}
      >
        <span className="truncate text-[15px] font-medium">
          {friend.nickname}
        </span>
        {selected ? (
          <Check className="size-4 text-muted-foreground" aria-hidden />
        ) : null}
      </button>
      <button
        type="button"
        onClick={onOpenVisibility}
        aria-label={`${friend.nickname} 노출 항목 설정`}
        className="inline-flex items-center justify-center rounded-2xl px-3 text-muted-foreground hover:bg-muted"
      >
        <Settings2 className="size-4" />
      </button>
    </li>
  );
}
