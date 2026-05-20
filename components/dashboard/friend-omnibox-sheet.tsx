"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  ArrowLeftCircle,
  Check,
  Loader2,
  Plus,
  Search,
  Settings2,
  Users,
} from "lucide-react";

import {
  AddFriendSheet,
  type ActiveFriendCode,
} from "@/components/friends/add-friend-sheet";
import {
  FriendVisibilitySheet,
  type FriendVisibilityTarget,
} from "@/components/friends/friend-visibility-sheet";
import type { FriendVisibilityPerms } from "@/components/friends/friend-visibility-toggles";
import { useExternalNavPending } from "@/components/layout/nav-progress";
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

  // Track navigation state so we can show a spinner on the clicked row and
  // keep the sheet open until the RSC payload lands. Without this the user
  // taps a friend, the sheet vanishes, and the dashboard stays frozen on the
  // previous viewer until the network finishes — there's no feedback that
  // the tap was even registered.
  const [isPending, startTransition] = useTransition();
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  // Push the pending bit into the shared NavProgress context so the
  // top-of-page progress bar fires too. Belt and suspenders with the row
  // spinner in case the sheet closes faster than the user can register it.
  useExternalNavPending(isPending);

  const isOwnView = currentViewingUserId === viewerUserId;

  // Warm the RSC payload for every friend (and the self view) the moment the
  // sheet opens. By the time the user picks a row, Next has likely already
  // fetched the React tree for that target — `router.push` becomes a swap
  // instead of a full Korea→US→Korea round-trip stack.
  useEffect(() => {
    if (!open) return;
    const baseParams = new URLSearchParams(searchParams?.toString() ?? "");
    baseParams.delete("ym");
    baseParams.delete("day");

    const targets = [viewerUserId, ...friends.map((f) => f.userId)];
    for (const target of targets) {
      const p = new URLSearchParams(baseParams);
      if (target === viewerUserId) p.delete("viewing");
      else p.set("viewing", target);
      const qs = p.toString();
      router.prefetch(qs ? `/dashboard?${qs}` : "/dashboard");
    }
  }, [open, friends, viewerUserId, router, searchParams]);

  // Close the sheet once the server commits the navigation — i.e. the page
  // re-renders with `currentViewingUserId` matching the row the user tapped.
  // Spinner display uses isPending which flips back to false at the same
  // time, so pendingTarget itself doesn't need to be reset.
  useEffect(() => {
    if (pendingTarget !== null && currentViewingUserId === pendingTarget) {
      onOpenChange(false);
    }
  }, [currentViewingUserId, pendingTarget, onOpenChange]);

  function navigate(viewing: string) {
    if (isPending) return;
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
    const href = qs ? `/dashboard?${qs}` : "/dashboard";

    setPendingTarget(viewing);
    startTransition(() => {
      router.push(href);
    });
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
            pending={isPending && pendingTarget === viewerUserId}
            disabled={isPending}
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
                pending={isPending && pendingTarget === f.userId}
                disabled={isPending}
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

        {/* Group management entry point. Navigates away (no nested sheet)
            because /friends/groups is a full page, not a list overlay. */}
        <Link
          href="/friends/groups"
          onClick={() => onOpenChange(false)}
          className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-muted text-[14px] font-medium text-foreground hover:bg-secondary"
        >
          <Users className="size-4" aria-hidden />
          그룹 관리
        </Link>
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
  pending,
  disabled,
  onClick,
}: {
  nickname: string;
  selected: boolean;
  isFriendMode: boolean;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-busy={pending}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors",
          selected ? "bg-secondary" : "hover:bg-muted",
          disabled && !pending && "opacity-50",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 text-[15px] font-medium">
          <span className="truncate">{nickname}</span>
          <span className="shrink-0 text-[12px] font-normal text-muted-foreground">
            (나)
          </span>
        </span>
        {pending ? (
          <Loader2
            className="size-4 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : selected ? (
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
  pending,
  disabled,
  onSelect,
  onOpenVisibility,
}: {
  friend: FriendOption;
  selected: boolean;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
  onOpenVisibility: () => void;
}) {
  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-busy={pending}
        className={cn(
          "flex flex-1 items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors",
          selected ? "bg-secondary" : "hover:bg-muted",
          disabled && !pending && "opacity-50",
        )}
      >
        <span className="truncate text-[15px] font-medium">
          {friend.nickname}
        </span>
        {pending ? (
          <Loader2
            className="size-4 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : selected ? (
          <Check className="size-4 text-muted-foreground" aria-hidden />
        ) : null}
      </button>
      <button
        type="button"
        onClick={onOpenVisibility}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-2xl px-3 text-muted-foreground hover:bg-muted",
          disabled && "opacity-50",
        )}
        aria-label={`${friend.nickname} 노출 항목 설정`}
      >
        <Settings2 className="size-4" />
      </button>
    </li>
  );
}
