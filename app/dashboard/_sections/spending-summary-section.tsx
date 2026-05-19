import { SpendingSummary } from "@/components/dashboard/spending-summary";
import { getMonthlyTransactions } from "@/lib/queries/transactions";
import { createClient } from "@/lib/supabase/server";

type SpendingSummarySectionProps = {
  /** Viewer id resolved by the page from JWT claims — no auth call here. */
  viewerId: string;
  startIso: string;
  endIso: string;
  cycleLabel: string;
  targetUserId?: string;
  /**
   * Own-mode user_settings prefetched by the page so this section can skip a
   * round-trip. Ignored in friend mode.
   */
  ownSettings?: { hasSettings: boolean; monthlyIncome: number };
  /** Own-mode fixed-expense total, prefetched by the page. Ignored in friend mode. */
  ownFixedExpense?: number;
  /**
   * Friend-mode visibility flags. Ignored in own mode (where the data owner
   * always has full visibility of their own data).
   */
  showSpendingTotal?: boolean;
  showSpendingItems?: boolean;
  /**
   * Cycle bounds and mode for the pace line ("이번 달이 끝나기까지 · 남은 N일 ·
   * 하루 X원"). Used only in own mode; friend mode never receives or shows
   * pace info because it derives from `remainingBudget` (privacy).
   */
  cycleStart?: Date;
  cycleEnd?: Date;
  cycleMode?: "calendar" | "income_day";
};

export async function SpendingSummarySection({
  viewerId,
  startIso,
  endIso,
  cycleLabel,
  targetUserId,
  ownSettings,
  ownFixedExpense,
  showSpendingTotal = true,
  showSpendingItems = true,
  cycleStart,
  cycleEnd,
  cycleMode,
}: SpendingSummarySectionProps) {
  const userId = targetUserId ?? viewerId;
  const isOwn = userId === viewerId;

  // Friend mode: this section ONLY renders the total spending card. The
  // calendar + day list block is rendered separately by SpendingCalendarSection
  // and is gated independently by `show_spending_items`. So:
  //   - If `show_spending_total` is OFF, render nothing here — even if items
  //     are ON, the total card still must not appear.
  //   - If items are ON, we already have row-level SELECT (RLS) and can sum
  //     transactions client-side without a separate RPC.
  //   - If only total is granted (items OFF), the SECURITY DEFINER RPC is
  //     the only path because RLS blocks row-level SELECT.
  if (!isOwn) {
    if (!showSpendingTotal) return null;

    if (showSpendingItems) {
      const monthlyResult = await getMonthlyTransactions(
        userId,
        startIso,
        endIso,
      );
      if (!monthlyResult.ok) {
        return (
          <div className="space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
            <p className="font-semibold">{`${cycleLabel} 요약을 불러오지 못했어요`}</p>
            <p className="break-all text-xs opacity-80">{monthlyResult.error}</p>
          </div>
        );
      }
      return (
        <SpendingSummary
          monthlyIncome={0}
          fixedExpense={0}
          monthlyExpense={monthlyResult.monthlyTotal}
          hasSettings={false}
          friendView
          cycleLabel={cycleLabel}
        />
      );
    }

    // Total-only path (items OFF, total ON).
    const supabase = await createClient();
    const { data: totalData, error: totalError } = await supabase.rpc(
      "get_friend_spending_total",
      { target: userId, start_iso: startIso, end_iso: endIso },
    );
    if (totalError) {
      return (
        <div className="space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <p className="font-semibold">{`${cycleLabel} 요약을 불러오지 못했어요`}</p>
          <p className="break-all text-xs opacity-80">{totalError.message}</p>
        </div>
      );
    }
    return (
      <SpendingSummary
        monthlyIncome={0}
        fixedExpense={0}
        monthlyExpense={Number(totalData ?? 0)}
        hasSettings={false}
        friendView
        cycleLabel={cycleLabel}
      />
    );
  }

  // Own mode: user_settings + fixed_expenses are prefetched by the page.
  // Only transactions remain — single round-trip (dedup'd by React cache()
  // when SpendingCalendarSection asks for the same range).
  const monthlyResult = await getMonthlyTransactions(userId, startIso, endIso);

  if (!monthlyResult.ok) {
    return (
      <div className="space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">{`${cycleLabel} 요약을 불러오지 못했어요`}</p>
        <p className="break-all text-xs opacity-80">{monthlyResult.error}</p>
      </div>
    );
  }

  // Pace info: rendered only when the *currently selected* cycle is the one
  // we're living in. Past/future cycles have no actionable pace.
  let daysRemaining: number | null = null;
  if (cycleStart && cycleEnd) {
    const now = new Date();
    const inCycle =
      now.getTime() >= cycleStart.getTime() &&
      now.getTime() < cycleEnd.getTime();
    if (inCycle) {
      const todayMid = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).getTime();
      // `cycleEnd` is exclusive — last day of cycle is (cycleEnd − 1 day).
      const lastDayDate = new Date(cycleEnd.getTime() - 86_400_000);
      const lastDayMid = new Date(
        lastDayDate.getFullYear(),
        lastDayDate.getMonth(),
        lastDayDate.getDate(),
      ).getTime();
      daysRemaining = Math.max(
        0,
        Math.round((lastDayMid - todayMid) / 86_400_000),
      );
    }
  }

  return (
    <SpendingSummary
      monthlyIncome={ownSettings?.monthlyIncome ?? 0}
      fixedExpense={ownFixedExpense ?? 0}
      monthlyExpense={monthlyResult.monthlyTotal}
      hasSettings={ownSettings?.hasSettings ?? false}
      friendView={false}
      cycleLabel={cycleLabel}
      daysRemainingInCycle={daysRemaining}
      cycleMode={cycleMode}
    />
  );
}
