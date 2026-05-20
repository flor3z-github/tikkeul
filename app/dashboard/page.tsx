import Link from "next/link";
import { Suspense } from "react";
import { MessageCircle, Settings } from "lucide-react";

import { FriendRealtimeWatcher } from "@/components/dashboard/friend-realtime-watcher";
import { DashboardFriendHeader } from "@/components/dashboard/dashboard-friend-header";
import { NotificationNudgeCard } from "@/components/dashboard/notification-nudge-card";
import { AppShell } from "@/components/layout/app-shell";
import { PwaInstallBanner } from "@/components/pwa/install-banner";
import { PageHeader } from "@/components/layout/header";
import { LinkPending } from "@/components/layout/nav-progress";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type CycleSettings,
  DEFAULT_CYCLE,
  resolveDashboardParams,
} from "@/lib/utils/calendar";
import { getActiveFriendCode } from "@/lib/queries/friend-codes";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FriendFixedSection } from "./_sections/friend-fixed-section";
import { SpendingSummarySection } from "./_sections/spending-summary-section";
import { SpendingSummarySkeleton } from "./_sections/spending-summary-skeleton";
import { SpendingCalendarSection } from "./_sections/spending-calendar-section";
import { SpendingCalendarSkeleton } from "./_sections/spending-calendar-skeleton";
import { SearchSheet } from "@/components/dashboard/search-sheet";

// PPR is enabled globally via `cacheComponents: true` in next.config.ts; no
// per-route opt-in needed in Next 16. The dashboard's loading.tsx provides
// the static shell that Next prerenders and serves from CDN edge while the
// dynamic body streams in. Per-Suspense fallbacks inside the page (Summary
// / Calendar skeletons) still apply once the body starts streaming.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DashboardSearchParams = Promise<{
  ym?: string;
  day?: string;
  viewing?: string;
  focus?: string;
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const sp = await searchParams;

  const supabase = await createClient();
  // Use getClaims (local JWKS verify, no Auth API RTT) instead of getUser.
  // Middleware already verified the JWT via the same mechanism — RLS still
  // fences every query, so we don't lose authorization safety.
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId = claimsData?.claims?.sub ?? null;
  if (!viewerId) redirect("/login");

  // Round 1: independent queries fired in parallel. We need `friendships`
  // (to know friend ids before validating the `viewing` param) and we
  // opportunistically prefetch the self user_settings + active friend code
  // here too — the network cost overlaps with the friendships query.
  const [outboundRowsRes, ownSettingsRes, initialActiveCode] = await Promise.all(
    [
      supabase
        .from("friendships")
        .select(
          "viewer_id, show_spending_total, show_spending_items, show_fixed_total, show_fixed_items",
        )
        .eq("owner_id", viewerId),
      supabase
        .from("user_settings")
        .select(
          "cycle_mode, cycle_start_day, monthly_income, friend_spending_notifications, transaction_interaction_notifications",
        )
        .eq("user_id", viewerId)
        .maybeSingle(),
      getActiveFriendCode(viewerId),
    ],
  );

  const outboundByFriendId = new Map<
    string,
    {
      show_spending_total: boolean;
      show_spending_items: boolean;
      show_fixed_total: boolean;
      show_fixed_items: boolean;
    }
  >();
  for (const row of outboundRowsRes.data ?? []) {
    if (!row.viewer_id || row.viewer_id === viewerId) continue;
    outboundByFriendId.set(row.viewer_id, {
      show_spending_total: row.show_spending_total,
      show_spending_items: row.show_spending_items,
      show_fixed_total: row.show_fixed_total,
      show_fixed_items: row.show_fixed_items,
    });
  }

  const friendIds = Array.from(outboundByFriendId.keys());

  // Validate viewing param: must be a friend the viewer is paired with.
  const requestedViewing =
    sp.viewing && UUID_RE.test(sp.viewing) ? sp.viewing : null;
  const viewingUserId =
    requestedViewing && friendIds.includes(requestedViewing)
      ? requestedViewing
      : viewerId;
  const isOwn = viewingUserId === viewerId;

  // ?focus=<txId> is set by:
  //   - the friend-spending push notification (friend mode), and
  //   - the own-mode memo search sheet (jumps the viewer to the cycle/day
  //     containing the matched transaction).
  // Validate the shape only; the day panel itself decides whether the row
  // actually exists in the resolved cycle (and toasts on miss).
  const focusTxId =
    sp.focus && UUID_RE.test(sp.focus) ? sp.focus : null;

  // Round 2: queries that need either round-1 results or the resolved
  // viewingUserId. All independent — fired in parallel. Friend-only queries
  // are stubbed in own mode so the array shape stays stable.
  const profileTargets = Array.from(new Set([viewerId, ...friendIds]));
  const [
    profileRowsRes,
    friendCycleRes,
    permsRowRes,
    ownFixedRes,
    dmIndexRes,
  ] = await Promise.all([
    profileTargets.length > 0
      ? supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", profileTargets)
      : Promise.resolve({
          data: [] as { id: string; display_name: string | null }[],
        }),
    !isOwn
      ? supabase.rpc("get_user_cycle", { target: viewingUserId })
      : Promise.resolve({ data: null }),
    !isOwn
      ? supabase
          .from("friendships")
          .select(
            "show_spending_total, show_spending_items, show_fixed_total, show_fixed_items",
          )
          .eq("owner_id", viewingUserId)
          .eq("viewer_id", viewerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isOwn
      ? supabase
          .from("fixed_expenses")
          .select("amount")
          .eq("user_id", viewerId)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as { amount: number }[] }),
    isOwn
      ? supabase.rpc("get_my_dm_index")
      : Promise.resolve({ data: null }),
  ]);

  // Resolve cycle: own → from user_settings; friend → from get_user_cycle.
  let cycle: CycleSettings = DEFAULT_CYCLE;
  let ownSettings: { hasSettings: boolean; monthlyIncome: number } = {
    hasSettings: false,
    monthlyIncome: 0,
  };
  if (isOwn) {
    const ownRow = ownSettingsRes.data;
    if (ownRow) {
      cycle = {
        mode: ownRow.cycle_mode,
        startDay: Number(ownRow.cycle_start_day ?? 1),
      };
      ownSettings = {
        hasSettings: true,
        monthlyIncome: Number(ownRow.monthly_income ?? 0),
      };
    }
  } else {
    const row = ((friendCycleRes.data ?? []) as Array<{
      cycle_mode: "calendar" | "income_day";
      cycle_start_day: number | null;
    }>)[0];
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

  const nicknameById = new Map<string, string>(
    (profileRowsRes.data ?? []).map((row) => [
      row.id,
      row.display_name ?? "이름 없음",
    ]),
  );
  const selfNickname = nicknameById.get(viewerId) ?? "나";
  const friendOptions = friendIds.map((id) => ({
    userId: id,
    nickname: nicknameById.get(id) ?? "이름 없음",
    perms: outboundByFriendId.get(id) ?? {
      show_spending_total: true,
      show_spending_items: true,
      show_fixed_total: false,
      show_fixed_items: false,
    },
  }));
  const viewingNickname = nicknameById.get(viewingUserId) ?? "";

  // Own-mode fixed-expense total, hoisted from sections so both Summary and
  // Calendar receive the same prefetched number.
  const ownFixedExpense = (ownFixedRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0,
  );

  // Push-notification nudge: only meaningful in own mode once the user has
  // at least one friend and has not engaged with any notification opt-in yet.
  // If either flag is already on, the user has decided — don't re-nudge.
  // The card itself does further client-side gating (browser support,
  // permission state, iOS-PWA, localStorage dismiss).
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const anyNotificationEnabled =
    Boolean(ownSettingsRes.data?.friend_spending_notifications) ||
    Boolean(ownSettingsRes.data?.transaction_interaction_notifications);
  const showNotificationNudge =
    isOwn &&
    friendIds.length > 0 &&
    !anyNotificationEnabled &&
    Boolean(vapidPublicKey);

  // Sum unread DMs across the caller's threads. Only computed in own mode
  // (friend mode passes the stubbed null through); the badge is hidden in
  // friend mode anyway because the MessageCircle Link itself is gated on
  // `isOwn` in the header below.
  const totalUnreadDms = isOwn
    ? (
        (dmIndexRes?.data ?? []) as Array<{ unread: number | string | null }>
      ).reduce((sum, row) => sum + Number(row.unread ?? 0), 0)
    : 0;

  // Friend-mode visibility perms. In own mode the owner has full visibility.
  // Friend mode fails closed: missing row or nullish columns => visibility off.
  const permsRow = permsRowRes.data;
  const perms = isOwn
    ? {
        spendingTotal: true,
        spendingItems: true,
        fixedTotal: true,
        fixedItems: true,
      }
    : {
        spendingTotal: permsRow?.show_spending_total ?? false,
        spendingItems: permsRow?.show_spending_items ?? false,
        fixedTotal: permsRow?.show_fixed_total ?? false,
        fixedItems: permsRow?.show_fixed_items ?? false,
      };

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
            <DashboardFriendHeader
              isOwn={isOwn}
              selfNickname={selfNickname}
              viewerUserId={viewerId}
              friends={friendOptions}
              currentViewingUserId={viewingUserId}
              viewingNickname={viewingNickname}
              initialActiveCode={initialActiveCode}
            />
            {isOwn ? (
              <SearchSheet
                cycleMode={cycle.mode}
                cycleStartDay={cycle.startDay}
              />
            ) : null}
            {isOwn ? (
              <Link
                href="/dm"
                prefetch
                aria-label={
                  totalUnreadDms > 0
                    ? `메시지 (읽지 않은 메시지 ${totalUnreadDms}개)`
                    : "메시지"
                }
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "relative rounded-full text-muted-foreground",
                )}
              >
                <MessageCircle className="size-5" />
                {totalUnreadDms > 0 ? (
                  <span
                    aria-hidden
                    className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-background"
                  />
                ) : null}
                <LinkPending />
              </Link>
            ) : null}
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

      <FriendRealtimeWatcher
        ownerUserId={viewingUserId}
        isOwn={isOwn}
        nicknameById={nicknameById}
      />

      {allHiddenInFriendMode ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          친구가 모든 항목을 비공개로 설정했어요.
        </div>
      ) : isOwn ? (
        <>
          <Suspense fallback={<SpendingSummarySkeleton />}>
            <SpendingSummarySection
              viewerId={viewerId}
              startIso={startIso}
              endIso={endIso}
              cycleLabel={cycleLabel}
              targetUserId={undefined}
              ownSettings={ownSettings}
              ownFixedExpense={ownFixedExpense}
              showSpendingTotal={perms.spendingTotal}
              showSpendingItems={perms.spendingItems}
              cycleStart={cycleStart}
              cycleEnd={cycleEnd}
              cycleMode={cycleMode}
            />
          </Suspense>

          <PwaInstallBanner />

          {showNotificationNudge ? (
            <NotificationNudgeCard vapidPublicKey={vapidPublicKey} />
          ) : null}

          <Suspense fallback={<SpendingCalendarSkeleton />}>
            <SpendingCalendarSection
              viewerId={viewerId}
              ym={ym}
              initialDay={day}
              startIso={startIso}
              endIso={endIso}
              cycleStart={cycleStart}
              cycleEnd={cycleEnd}
              cycleMode={cycleMode}
              cycleLabel={cycleLabel}
              targetUserId={undefined}
              ownSettings={ownSettings}
              ownFixedExpense={ownFixedExpense}
              showSpendingItems={perms.spendingItems}
              focusTxId={focusTxId}
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
                      viewerId={viewerId}
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
                      viewerId={viewerId}
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
                      focusTxId={focusTxId}
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
