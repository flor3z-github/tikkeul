import Link from "next/link";
import { Suspense } from "react";
import { MessageCircle, Settings } from "lucide-react";

import { FriendRealtimeWatcher } from "@/components/dashboard/friend-realtime-watcher";
import { RefreshOnRestore } from "@/components/dm/refresh-on-restore";
import { DashboardFriendHeader } from "@/components/dashboard/dashboard-friend-header";
import { NotificationNudgeCard } from "@/components/dashboard/notification-nudge-card";
import { ReleaseNotesPopup } from "@/components/dashboard/release-notes-popup";
import { PushReconciler } from "@/components/push/push-reconciler";
import { AppShell } from "@/components/layout/app-shell";
import { PwaInstallBanner } from "@/components/pwa/install-banner";
import { PageHeader } from "@/components/layout/header";
import { LinkPending } from "@/components/layout/nav-progress";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseYearMonth } from "@/lib/utils/calendar";
import {
  resolveDashboardParamsB,
  type PayrollRule,
} from "@/lib/utils/payday-cycle";
import { getHolidays, holidayRangeForAnchor } from "@/lib/queries/holidays";
import { getActiveFriendCode } from "@/lib/queries/friend-codes";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FriendFixedSection } from "./_sections/friend-fixed-section";
import { SpendingSummarySection } from "./_sections/spending-summary-section";
import { SpendingSummarySkeleton } from "./_sections/spending-summary-skeleton";
import { SpendingCalendarSection } from "./_sections/spending-calendar-section";
import { SpendingCalendarSkeleton } from "./_sections/spending-calendar-skeleton";
import { SearchSheet } from "@/components/dashboard/search-sheet";
import { LongPressGuide } from "@/components/onboarding/long-press-guide";
import { toISODate, nowInSeoul } from "@/lib/utils/date";

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
          "payday, payroll_rule, monthly_income, friend_spending_notifications, transaction_interaction_notifications",
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
  // Holidays for the viewed anchor year ±1 (cycles cross year boundaries — a
  // Jan cycle can start in prior-year Dec, a Dec 말일 cycle can end in next-year
  // Jan). Independent of viewingUserId, so it rides Round 2's parallel batch to
  // avoid a serial RTT. Resolved BEFORE the cycle so resolveDashboardParamsB
  // sees the full holiday set.
  const anchorYear =
    parseYearMonth(sp.ym ?? "")?.getFullYear() ?? new Date().getFullYear();
  const { yearStart: holidayYearStart, yearEnd: holidayYearEnd } =
    holidayRangeForAnchor(anchorYear);
  const [
    profileRowsRes,
    friendCycleRes,
    permsRowRes,
    dmIndexRes,
    ownTxCountRes,
    holidays,
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
      ? supabase.rpc("get_my_dm_index")
      : Promise.resolve({ data: null }),
    // Lifetime transaction count: drives the long-press onboarding overlay.
    // We only show the guide once the user has at least one transaction, so
    // first-time users learn the primary tap action before discovering the
    // secondary long-press action. `head: true` skips row payload.
    isOwn
      ? supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", viewerId)
          .is("deleted_at", null)
      : Promise.resolve({ count: 0 as number | null }),
    getHolidays(holidayYearStart, holidayYearEnd, supabase),
  ]);

  // Resolve cycle: own → from user_settings (payday + payroll_rule); friend →
  // from get_user_cycle (returns the same two fields, never monthly_income).
  // Model B: the cycle is computed in JS from payday + payroll_rule + the
  // public-holiday set, so friend cycles need no extra DB exposure.
  let payday = 1;
  let rule: PayrollRule = "prev";
  let ownSettings: { hasSettings: boolean; monthlyIncome: number } = {
    hasSettings: false,
    monthlyIncome: 0,
  };
  if (isOwn) {
    const ownRow = ownSettingsRes.data;
    if (ownRow) {
      payday = Number(ownRow.payday ?? 1);
      rule = (ownRow.payroll_rule ?? "prev") as PayrollRule;
      ownSettings = {
        hasSettings: true,
        monthlyIncome: Number(ownRow.monthly_income ?? 0),
      };
    }
  } else {
    const row = ((friendCycleRes.data ?? []) as Array<{
      payday: number;
      payroll_rule: "prev" | "same" | "next";
    }>)[0];
    if (row) {
      payday = Number(row.payday ?? 1);
      rule = (row.payroll_rule ?? "prev") as PayrollRule;
    }
  }

  const { ym, day, cycleStart, cycleEnd, cycleMode, cycleLabel } =
    resolveDashboardParamsB(sp, payday, rule, holidays, nowInSeoul());
  const startIso = cycleStart.toISOString();
  const endIso = cycleEnd.toISOString();

  // Round 3: per-cycle income adjustments (own mode only). Cannot be in round
  // 2 because the cycle bounds aren't resolved until after round 2 settings
  // land. Compared as YYYY-MM-DD against the `date`-typed `occurred_on`
  // column to avoid timezone round-trips. Friend mode never reads this —
  // income_adjustments inherits the same privacy stance as monthly_income.
  const cycleStartDate = toISODate(cycleStart);
  const cycleEndDate = toISODate(cycleEnd);
  const ownExtraIncomeRes = isOwn
    ? await supabase
        .from("income_adjustments")
        .select("id, amount, occurred_on, memo")
        .eq("user_id", viewerId)
        .gte("occurred_on", cycleStartDate)
        .lt("occurred_on", cycleEndDate)
        .order("occurred_on", { ascending: false })
        .order("id", { ascending: false })
    : {
        data: [] as {
          id: string;
          amount: number;
          occurred_on: string;
          memo: string | null;
        }[],
      };
  const ownExtraIncomeItems = (ownExtraIncomeRes.data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount ?? 0),
    occurredOn: row.occurred_on,
    memo: row.memo,
  }));
  const ownExtraIncome = ownExtraIncomeItems.reduce(
    (sum, row) => sum + row.amount,
    0,
  );

  const lifetimeTxCount = isOwn ? (ownTxCountRes.count ?? 0) : 0;

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

  // Own-mode effective fixed expenses for the displayed cycle (amount =
  // override ?? base). Runs in round 3 because it needs the resolved cycle's
  // anchorYm (`ym`). Hoisted from the sections so the Summary card, the budget
  // math, and the Calendar/day-panel markers all use the same prefetched,
  // override-aware numbers. Friend mode never fetches this — friend fixed
  // visibility flows through FriendFixedSection's perm-gated RPCs.
  const ownFixedEffectiveRes = isOwn
    ? await supabase.rpc("get_fixed_effective_items", {
        target: viewerId,
        cycle_anchor: ym,
      })
    : {
        data: [] as {
          id: string;
          subscription_plan_id: string | null;
          name: string;
          plan_name: string | null;
          amount: number | null;
          base_amount: number | null;
          category: string | null;
          payment_day: number | null;
          is_overridden: boolean;
        }[],
      };
  const ownFixedEffectiveItems = (ownFixedEffectiveRes.data ?? []).map(
    (row) => ({
      id: row.id,
      name: row.name,
      plan_name: row.plan_name,
      amount: row.amount == null ? null : Number(row.amount),
      base_amount: row.base_amount == null ? null : Number(row.base_amount),
      payment_day: row.payment_day,
      is_overridden: row.is_overridden,
    }),
  );
  const ownFixedExpense = ownFixedEffectiveItems.reduce(
    (sum, row) => sum + (row.amount ?? 0),
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
                payday={payday}
                payrollRule={rule}
                holidays={Array.from(holidays)}
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
      {isOwn ? <RefreshOnRestore /> : null}

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
              ownExtraIncome={ownExtraIncome}
              ownExtraIncomeItems={ownExtraIncomeItems}
              cycleStartDate={cycleStartDate}
              cycleEndDate={cycleEndDate}
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

          {isOwn && vapidPublicKey && anyNotificationEnabled ? (
            <PushReconciler
              vapidPublicKey={vapidPublicKey}
              enabled={anyNotificationEnabled}
            />
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
              ownFixedEffectiveItems={ownFixedEffectiveItems}
              ownExtraIncome={ownExtraIncome}
              showSpendingItems={perms.spendingItems}
              hasFriends={friendIds.length > 0}
              focusTxId={focusTxId}
            />
          </Suspense>

          {lifetimeTxCount > 0 ? <LongPressGuide /> : null}
          {lifetimeTxCount > 0 ? <ReleaseNotesPopup /> : null}
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
                    cycleAnchor={ym}
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
