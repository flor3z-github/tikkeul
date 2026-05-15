import Link from "next/link";
import { Suspense } from "react";
import { Settings } from "lucide-react";

import { FriendRealtimeWatcher } from "@/components/dashboard/friend-realtime-watcher";
import { FriendSwitcher } from "@/components/dashboard/friend-switcher";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { LinkPending } from "@/components/layout/nav-progress";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type CycleSettings,
  DEFAULT_CYCLE,
  resolveDashboardParams,
} from "@/lib/utils/calendar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FriendFixedSection } from "./_sections/friend-fixed-section";
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
  day?: string;
  viewing?: string;
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const sp = await searchParams;

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

  // Fetch the *viewing* user's budget cycle so the dashboard aligns with how
  // that person tracks spending. For self, read user_settings directly; for a
  // friend, use the get_user_cycle RPC which gates access by friendship and
  // never exposes monthly_income.
  let cycle: CycleSettings = DEFAULT_CYCLE;
  if (isOwn) {
    const { data: ownCycle } = await supabase
      .from("user_settings")
      .select("cycle_mode, cycle_start_day")
      .eq("user_id", user.id)
      .maybeSingle();
    if (ownCycle) {
      cycle = {
        mode: ownCycle.cycle_mode,
        startDay: Number(ownCycle.cycle_start_day ?? 1),
      };
    }
  } else {
    const { data: friendCycleRows } = await supabase.rpc("get_user_cycle", {
      target: viewingUserId,
    });
    const row = (friendCycleRows ?? [])[0];
    if (row) {
      cycle = {
        mode: row.cycle_mode,
        startDay: Number(row.cycle_start_day ?? 1),
      };
    }
  }

  const { ym, day, cycleStart, cycleEnd, cycleMode, cycleLabel } =
    resolveDashboardParams(sp, cycle);
  const startIso = cycleStart.toISOString();
  const endIso = cycleEnd.toISOString();

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

  // Friend-mode visibility perms. Defaults to fully-open in own mode so the
  // existing UI is unchanged. In friend mode we fetch the outbound row from
  // the owner's perspective (owner_id = viewingUserId, viewer_id = me) and
  // fail closed: a missing row or nullish columns => visibility off.
  const perms = isOwn
    ? {
        spendingTotal: true,
        spendingItems: true,
        fixedTotal: true,
        fixedItems: true,
      }
    : await (async () => {
        const { data: permsRow } = await supabase
          .from("friendships")
          .select(
            "show_spending_total, show_spending_items, show_fixed_total, show_fixed_items",
          )
          .eq("owner_id", viewingUserId)
          .eq("viewer_id", user.id)
          .maybeSingle();
        return {
          spendingTotal: permsRow?.show_spending_total ?? false,
          spendingItems: permsRow?.show_spending_items ?? false,
          fixedTotal: permsRow?.show_fixed_total ?? false,
          fixedItems: permsRow?.show_fixed_items ?? false,
        };
      })();

  const allHiddenInFriendMode =
    !isOwn &&
    !perms.spendingTotal &&
    !perms.spendingItems &&
    !perms.fixedTotal &&
    !perms.fixedItems;

  return (
    <AppShell withBottomNav={isOwn} withFab={isOwn}>
      <PageHeader
        title="티끌"
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
              <LinkPending />
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

      {allHiddenInFriendMode ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          친구가 모든 항목을 비공개로 설정했어요.
        </div>
      ) : isOwn ? (
        <>
          <Suspense fallback={<SpendingSummarySkeleton />}>
            <SpendingSummarySection
              startIso={startIso}
              endIso={endIso}
              cycleLabel={cycleLabel}
              targetUserId={undefined}
              showSpendingTotal={perms.spendingTotal}
              showSpendingItems={perms.spendingItems}
            />
          </Suspense>

          <Suspense fallback={<SpendingCalendarSkeleton />}>
            <SpendingCalendarSection
              ym={ym}
              initialDay={day}
              startIso={startIso}
              endIso={endIso}
              cycleStart={cycleStart}
              cycleEnd={cycleEnd}
              cycleMode={cycleMode}
              cycleLabel={cycleLabel}
              targetUserId={undefined}
              showSpendingItems={perms.spendingItems}
            />
          </Suspense>
        </>
      ) : (
        // Friend mode: group blocks under "소비" / "고정지출" headings so
        // the viewer can tell at a glance what category they're seeing. The
        // outer wrapper is a typography-only section (h2 + spacing), not a
        // bordered card, to avoid card-in-card nesting per DESIGN.md §19.
        (() => {
          const showSpendingGroup =
            perms.spendingTotal || perms.spendingItems;
          const showFixedGroup = perms.fixedTotal || perms.fixedItems;
          return (
            <>
              {showSpendingGroup ? (
                <section className="mt-6 space-y-3">
                  <h2 className="px-1 text-xl font-bold tracking-[-0.02em]">
                    소비
                  </h2>
                  <Suspense fallback={<SpendingSummarySkeleton />}>
                    <SpendingSummarySection
                      startIso={startIso}
                      endIso={endIso}
                      cycleLabel={cycleLabel}
                      targetUserId={viewingUserId}
                      showSpendingTotal={perms.spendingTotal}
                      showSpendingItems={perms.spendingItems}
                    />
                  </Suspense>
                  <Suspense fallback={<SpendingCalendarSkeleton />}>
                    <SpendingCalendarSection
                      ym={ym}
                      initialDay={day}
                      startIso={startIso}
                      endIso={endIso}
                      cycleStart={cycleStart}
                      cycleEnd={cycleEnd}
                      cycleMode={cycleMode}
                      cycleLabel={cycleLabel}
                      targetUserId={viewingUserId}
                      showSpendingItems={perms.spendingItems}
                    />
                  </Suspense>
                </section>
              ) : null}

              {showSpendingGroup && showFixedGroup ? (
                <hr aria-hidden className="mt-8 border-border" />
              ) : null}

              {showFixedGroup ? (
                <section className="mt-6 space-y-3">
                  <h2 className="px-1 text-xl font-bold tracking-[-0.02em]">
                    고정지출
                  </h2>
                  <FriendFixedSection
                    target={viewingUserId}
                    showTotal={perms.fixedTotal}
                    showItems={perms.fixedItems}
                  />
                </section>
              ) : null}
            </>
          );
        })()
      )}
    </AppShell>
  );
}
