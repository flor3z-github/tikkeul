import { SpendingSummary } from "@/components/dashboard/spending-summary";
import { getMonthlyTransactions } from "@/lib/queries/transactions";
import { createClient } from "@/lib/supabase/server";
import { nowInSeoul } from "@/lib/utils/date";
import {
  fixedDelta,
  variableTotal,
  type FixedEffectiveItem,
} from "@/lib/utils/stats/cycle-breakdown";
import { clampToElapsedWindow } from "@/lib/utils/stats/elapsed-window";
import { cycleSpendTrend } from "@/lib/utils/stats/trend";
import { thisMonthSaved, type SavingsPlanRow } from "@/lib/utils/savings";

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
   * Own-mode effective fixed items (override-aware), prefetched by the page.
   * Used as the "this cycle" side of the 토스式 추세 고정 비교(fixedDelta,
   * matched-only). Ignored in friend mode.
   */
  ownFixedEffectiveItems?: FixedEffectiveItem[];
  /**
   * Own-mode per-cycle extra income (sum of `income_adjustments` whose
   * `occurred_on` falls inside the cycle), prefetched by the page so this
   * section can fold it into the budget summary without a round-trip.
   * Ignored in friend mode.
   */
  ownExtraIncome?: number;
  /**
   * Friend-mode visibility flags. Ignored in own mode (where the data owner
   * always has full visibility of their own data).
   */
  showSpendingTotal?: boolean;
  showSpendingItems?: boolean;
  /**
   * Friend-mode: owner granted fixed visibility (show_fixed_total OR
   * show_fixed_items). When true the section also fetches the friend's fixed
   * total (get_friend_fixed_total, perm re-checked server-side) so the card
   * shows the 고정/변동 split. Ignored in own mode.
   */
  showFixed?: boolean;
  /**
   * Friend-mode: owner granted show_savings_total (and show_spending_total — the
   * data-layer RPC ANDs both). When true the section fetches the friend's
   * "매달 모으는 돈" (get_friend_savings_total) and appends a 모으기 line to the
   * card. Ignored in own mode (own savings ride the 3-split hero). */
  showSavingsTotal?: boolean;
  /** Friend-mode cycle anchor (anchorYm "YYYY-MM") for get_friend_fixed_total. */
  cycleAnchor?: string;
  /**
   * Own-mode LABEL month ("YYYY-MM") of the displayed cycle, threaded into the
   * /stats entry CTA (`/stats?ym=`). Lets the 소비 구성 화면 render the SAME cycle
   * the card shows — not just the current one. Absent in friend mode (stats is
   * own-only). See statsHref below.
   */
  ym?: string;
  /**
   * Cycle bounds and mode for the pace line ("이번 달이 끝나기까지 · 남은 N일 ·
   * 하루 X원"). Used only in own mode; friend mode never receives or shows
   * pace info because it derives from `remainingBudget` (privacy).
   */
  cycleStart?: Date;
  cycleEnd?: Date;
  cycleMode?: "calendar" | "income_day";
  /**
   * Previous-cycle bounds + anchor (from the same payday engine as the current
   * cycle) for the 토스式 총액 추세. The section fetches prev tx/fixed and
   * computes the trend delta ONLY in own + current cycle; past/future cycles
   * (no actionable pace) and friend mode never receive a comparison. prev tx is
   * elapsed-clamped to the same point; prev fixed feeds fixedDelta (matched-only).
   */
  prevCycleStart?: Date;
  prevCycleEnd?: Date;
  prevCycleAnchor?: string;
};

export async function SpendingSummarySection({
  viewerId,
  startIso,
  endIso,
  cycleLabel,
  targetUserId,
  ownSettings,
  ownFixedExpense,
  ownExtraIncome,
  showSpendingTotal = true,
  showSpendingItems = true,
  showFixed = false,
  showSavingsTotal = false,
  cycleAnchor,
  ym,
  cycleStart,
  cycleEnd,
  cycleMode,
  ownFixedEffectiveItems,
  prevCycleStart,
  prevCycleEnd,
  prevCycleAnchor,
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

    const supabase = await createClient();

    // Variable (월소비) total: items path sums RLS-allowed rows client-side;
    // total-only path uses the SECURITY DEFINER RPC (RLS blocks the rows).
    let monthlyExpense: number;
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
      monthlyExpense = monthlyResult.monthlyTotal;
    } else {
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
      monthlyExpense = Number(totalData ?? 0);
    }

    // Fixed total for the 고정/변동 split. Gated by showFixed (owner granted
    // show_fixed_total OR show_fixed_items); get_friend_fixed_total re-checks
    // the perm server-side and never exposes income. fixedExpense stays 0 when
    // not granted, so the card falls back to variable-only.
    let friendFixed = 0;
    let fixedAvailable = false;
    if (showFixed && cycleAnchor) {
      const { data: fixedData, error: fixedError } = await supabase.rpc(
        "get_friend_fixed_total",
        { target: userId, cycle_anchor: cycleAnchor },
      );
      // On RPC failure, degrade to variable-only (drop the split) rather than
      // mislabeling the failed fetch as "고정 0원" — the spending number still
      // renders. Only show the breakdown when the fixed total truly resolved.
      if (!fixedError) {
        friendFixed = Number(fixedData ?? 0);
        fixedAvailable = true;
      }
    }

    // Savings total for the 모으기 line. friendSavings is folded into the 나간 돈
    // hero (SpendingSummary), so — exactly like own mode's `savings` — it's only
    // valid on the CURRENT cycle: get_friend_savings_total is a "now" snapshot
    // (thisMonthSaved, the recurring monthly commitment), whereas 변동/고정 are the
    // VIEWED cycle's totals. On a past/future friend cycle, folding today's
    // savings into that cycle's outflow would be wrong (and would mislabel it
    // 나간 돈). So gate on isCurrentCycle — mirrors the own-mode savings gate, and
    // collapses past cycles back to 「총 소비」 = 고정+변동 with no 모으기 line.
    // startIso/endIso are absolute instants (cycleStart/End.toISOString()), so the
    // ISO round-trip compares the same instant as the own-mode Date compare.
    const now = nowInSeoul();
    const isCurrentCycle =
      now.getTime() >= new Date(startIso).getTime() &&
      now.getTime() < new Date(endIso).getTime();
    // Gated by showSavingsTotal AND current cycle; the RPC re-checks
    // show_savings_total AND show_spending_total server-side and never exposes
    // income or per-plan rows. Stays 0 on failure, when not granted, or off-cycle.
    let friendSavings = 0;
    if (showSavingsTotal && isCurrentCycle) {
      const { data: savingsData, error: savingsError } = await supabase.rpc(
        "get_friend_savings_total",
        { target: userId },
      );
      if (!savingsError) {
        friendSavings = Number(savingsData ?? 0);
      }
    }

    return (
      <SpendingSummary
        monthlyIncome={0}
        fixedExpense={friendFixed}
        monthlyExpense={monthlyExpense}
        hasSettings={false}
        friendView
        showFixedBreakdown={fixedAvailable}
        friendSavings={friendSavings}
        cycleLabel={cycleLabel}
      />
    );
  }

  // Own mode. `now` (KST) drives BOTH the current-cycle gate and the prev-cycle
  // elapsed clamp so they agree.
  const now = nowInSeoul();
  // Whether the displayed cycle is the one we're living in. Gates the pace line
  // AND the 토스式 추세 — 추세 has no actionable pace on a past/future cycle, so we
  // only compute it for the live cycle. (The /stats CTA is NO LONGER gated on
  // this: it now threads `ym` so /stats renders whatever cycle the card shows —
  // see statsHref below. It's gated on cycleStarted instead, to hide future
  // cycles whose composition is empty.)
  const isCurrentCycle =
    !!cycleStart &&
    !!cycleEnd &&
    now.getTime() >= cycleStart.getTime() &&
    now.getTime() < cycleEnd.getTime();
  // The displayed cycle has begun (current or past). Future cycles (cycleStart
  // in the future) have no spending to compose, so the /stats entry is hidden.
  const cycleStarted =
    !!cycleStart && now.getTime() >= cycleStart.getTime();

  // 토스式 총액 추세는 own + 현재 주기 + 직전 주기 bounds가 있을 때만 직전 tx/fixed를
  // 가져온다(과거/미래 주기엔 행동 가능한 페이스가 없음). 현재 주기 tx와 병렬로.
  const wantTrend =
    isCurrentCycle && !!prevCycleStart && !!prevCycleEnd && !!prevCycleAnchor;
  // Client is needed for the trend RPC and/or the current-cycle savings read.
  // The 3-split savings bucket only appears on the current cycle (matching how
  // statsHref/daysRemaining gate), so we skip the savings query on past/future.
  const supabase = isCurrentCycle ? await createClient() : null;
  const [monthlyResult, prevMonthly, prevFixedRes, savingsRes] =
    await Promise.all([
      getMonthlyTransactions(userId, startIso, endIso),
      wantTrend
        ? getMonthlyTransactions(
            userId,
            prevCycleStart!.toISOString(),
            prevCycleEnd!.toISOString(),
          )
        : Promise.resolve(null),
      wantTrend
        ? supabase!.rpc("get_fixed_effective_items", {
            target: userId,
            cycle_anchor: prevCycleAnchor!,
          })
        : Promise.resolve(null),
      isCurrentCycle && supabase
        ? supabase
            .from("savings_plans")
            .select(
              "id, name, amount, payment_day, start_date, maturity_date, is_active",
            )
            .eq("user_id", userId)
            .eq("is_active", true)
        : Promise.resolve(null),
    ]);

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
  if (isCurrentCycle && cycleEnd) {
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

  // 총액 추세 델타(원). 직전 주기에 실거래가 있었을 때만(hasPrevBaseline) 계산해
  // 카드에 넘긴다 — 첫 주기가 상설 고정지출 대비 가짜 "+전부"로 뜨는 것 방지(/stats
  // 와 동일 게이트). 고정은 matched-only(fixedDelta), 변동은 같은 경과 시점 클램프.
  let trendDeltaWon: number | undefined = undefined;
  if (
    wantTrend &&
    prevMonthly?.ok &&
    prevMonthly.transactions.length > 0 &&
    cycleStart
  ) {
    const prevElapsed = clampToElapsedWindow(
      prevMonthly.transactions,
      cycleStart,
      prevCycleStart!,
      now,
    );
    // prev fixed RPC 실패 시 빈 배열 → fixedDelta가 0(고정 비교 생략, 변동만).
    const prevFixedItems: FixedEffectiveItem[] =
      prevFixedRes && !prevFixedRes.error
        ? mapFixedRpcRows(prevFixedRes.data)
        : [];
    trendDeltaWon = cycleSpendTrend({
      curVariable: monthlyResult.monthlyTotal,
      prevVariableElapsed: variableTotal(prevElapsed),
      fixedDeltaWon: fixedDelta(ownFixedEffectiveItems ?? [], prevFixedItems),
    });
  }

  // 돈모으기 bucket for the 3-split hero. Computed with `now` (today, KST) — the
  // SAME basis as the /savings tab hero (thisMonthSaved), so both screens agree
  // on the number. Only the current cycle sets it (past/future → 0 → the card
  // falls back to the 2-split). thisMonthSaved re-filters is_active + ongoing.
  let savings = 0;
  if (savingsRes && !savingsRes.error && savingsRes.data) {
    const plans: SavingsPlanRow[] = savingsRes.data.map((row) => ({
      id: row.id,
      name: row.name,
      amount: row.amount == null ? null : Number(row.amount),
      payment_day: row.payment_day ?? null,
      start_date: row.start_date,
      maturity_date: row.maturity_date ?? null,
      is_active: row.is_active,
    }));
    savings = thisMonthSaved(plans, now);
  }

  return (
    <SpendingSummary
      monthlyIncome={ownSettings?.monthlyIncome ?? 0}
      fixedExpense={ownFixedExpense ?? 0}
      monthlyExpense={monthlyResult.monthlyTotal}
      savings={savings}
      extraIncome={ownExtraIncome ?? 0}
      hasSettings={ownSettings?.hasSettings ?? false}
      friendView={false}
      cycleLabel={cycleLabel}
      daysRemainingInCycle={daysRemaining}
      cycleMode={cycleMode}
      statsHref={cycleStarted && ym ? `/stats?ym=${ym}` : undefined}
      trendDeltaWon={trendDeltaWon}
    />
  );
}

/** Map get_fixed_effective_items rows to FixedEffectiveItem (same shape the page
 *  uses for the current cycle), so fixedDelta compares like-for-like. */
type FixedRpcRow = {
  id: string;
  name: string;
  plan_name: string | null;
  amount: number | null;
  base_amount: number | null;
  category: string | null;
  payment_day: number | null;
  is_overridden: boolean;
};

function mapFixedRpcRows(data: unknown): FixedEffectiveItem[] {
  return ((data ?? []) as FixedRpcRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    plan_name: row.plan_name,
    amount: row.amount == null ? null : Number(row.amount),
    base_amount: row.base_amount == null ? null : Number(row.base_amount),
    category: row.category,
    payment_day: row.payment_day,
    is_overridden: row.is_overridden,
  }));
}
