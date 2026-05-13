import Link from "next/link";
import { Suspense } from "react";
import { Settings } from "lucide-react";

import { FriendRealtimeWatcher } from "@/components/dashboard/friend-realtime-watcher";
import { FriendSwitcher } from "@/components/dashboard/friend-switcher";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatYearMonthKorean,
  resolveDashboardParams,
} from "@/lib/utils/calendar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SpendingSummarySection } from "./_sections/spending-summary-section";
import { SpendingSummarySkeleton } from "./_sections/spending-summary-skeleton";
import { SpendingCalendarSection } from "./_sections/spending-calendar-section";
import { SpendingCalendarSkeleton } from "./_sections/spending-calendar-skeleton";

// Kept until Next 16 PPR is stable enough to enable. To migrate:
//   1) remove this line
//   2) add: export const experimental_ppr = true
//   3) set experimental.ppr = "incremental" in next.config.ts
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DashboardSearchParams = Promise<{
  ym?: string;
  viewing?: string;
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const sp = await searchParams;
  const { ym, day } = resolveDashboardParams(sp);
  const monthLabel = formatYearMonthKorean(ym);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Friends: who can this viewer see?
  const { data: friendshipRows } = await supabase
    .from("friendships")
    .select("owner_id")
    .eq("viewer_id", user.id);

  const friendIds = (friendshipRows ?? [])
    .map((row) => row.owner_id)
    .filter((id): id is string => Boolean(id) && id !== user.id);

  // Validate viewing param: must be a friend the viewer is paired with.
  const requestedViewing =
    sp.viewing && UUID_RE.test(sp.viewing) ? sp.viewing : null;
  const viewingUserId =
    requestedViewing && friendIds.includes(requestedViewing)
      ? requestedViewing
      : user.id;
  const isOwn = viewingUserId === user.id;

  // Profile lookups for the switcher + banner.
  const profileTargets = Array.from(new Set([user.id, ...friendIds]));
  const { data: profileRows } =
    profileTargets.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", profileTargets)
      : { data: [] };

  const nicknameById = new Map<string, string>(
    (profileRows ?? []).map((row) => [row.id, row.display_name ?? "이름 없음"]),
  );
  const selfNickname = nicknameById.get(user.id) ?? "나";
  const friendOptions = friendIds.map((id) => ({
    userId: id,
    nickname: nicknameById.get(id) ?? "이름 없음",
  }));
  const viewingNickname = nicknameById.get(viewingUserId) ?? "";

  return (
    <AppShell withBottomNav={isOwn} withFab={isOwn}>
      <PageHeader
        title={`${monthLabel} 소비`}
        trailing={
          <div className="flex items-center gap-1">
            <FriendSwitcher
              selfNickname={selfNickname}
              viewerUserId={user.id}
              friends={friendOptions}
              currentViewingUserId={viewingUserId}
            />
            <Link
              href="/settings"
              prefetch
              aria-label="설정"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "rounded-full text-muted-foreground",
              )}
            >
              <Settings className="size-5" />
            </Link>
          </div>
        }
      />

      {!isOwn ? (
        <>
          <FriendRealtimeWatcher friendUserId={viewingUserId} />
          <div className="mb-4 flex items-center justify-between rounded-2xl bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {viewingNickname}님의 티끌을 보고 있어요
            </span>
            <Link
              href="/dashboard"
              prefetch
              className="text-xs font-semibold underline-offset-4 hover:underline"
            >
              내 티끌로
            </Link>
          </div>
        </>
      ) : null}

      <Suspense fallback={<SpendingSummarySkeleton />}>
        <SpendingSummarySection
          ym={ym}
          targetUserId={isOwn ? undefined : viewingUserId}
        />
      </Suspense>

      <Suspense fallback={<SpendingCalendarSkeleton />}>
        <SpendingCalendarSection
          ym={ym}
          initialDay={day}
          targetUserId={isOwn ? undefined : viewingUserId}
        />
      </Suspense>
    </AppShell>
  );
}
