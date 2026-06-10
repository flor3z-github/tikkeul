import Link from "next/link";

import { IncomeLine, type IncomeLineItem } from "@/components/income/income-line";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatKRW, formatNumber } from "@/lib/utils/money";
import {
  calculateBudgetSummary,
  getSpendingStatus,
  type SpendingStatus,
} from "@/lib/utils/budget";
import { SpendingProgress } from "./spending-progress";

type SpendingSummaryProps = {
  monthlyIncome: number;
  fixedExpense: number;
  monthlyExpense: number;
  /**
   * Per-cycle one-shot income (bonus, refund, side income). Summed by the
   * page from `income_adjustments` whose `occurred_on` falls inside the
   * current cycle, then folded into `effectiveIncome` for spendingRate /
   * remainingBudget. Rendered as a secondary line under the hero numbers
   * when > 0. Defaults to 0 so existing callers keep working.
   */
  extraIncome?: number;
  /**
   * Per-cycle income adjustment rows. When provided alongside cycle bounds,
   * the summary line becomes tappable and opens the list/edit sheet. When
   * omitted (e.g. friend view, or callers that haven't migrated yet), the
   * line stays static.
   */
  extraIncomeItems?: IncomeLineItem[];
  /** YYYY-MM-DD bounds used by the income editor's calendar (inclusive start, exclusive end). */
  cycleStartDate?: string;
  cycleEndDate?: string;
  hasSettings: boolean;
  /**
   * When true, render only the spending total(s). Income, available budget,
   * spending rate, and the progress bar are hidden because they derive from
   * `monthly_income` (private to the data owner). Used when viewing a friend's
   * dashboard.
   */
  friendView?: boolean;
  /**
   * Friend mode only: the owner granted fixed visibility (show_fixed_total OR
   * show_fixed_items), so the card shows the 고정/변동 split — hero becomes the
   * true total spending (fixed + variable) with a "고정 X · 변동 Y" breakdown
   * line. Both numbers are already-permitted aggregates, so this leaks no
   * income/budget/rate. When false the friend card stays variable-only.
   */
  showFixedBreakdown?: boolean;
  /**
   * Identifier for the current budget cycle. When this changes (e.g. user
   * navigates to a different month), the hero number re-mounts and fades in
   * instead of snapping. Optional — friendView card also uses it.
   */
  cycleLabel?: string;
  /**
   * Days remaining in the selected cycle (last day − today). `null` means the
   * selected cycle is past or future, so no pace line is rendered. `0` means
   * today is the last day. Only used in own mode.
   */
  daysRemainingInCycle?: number | null;
  /**
   * Cycle mode controls the pace-line copy: "이번 달이 끝나기까지" for
   * `calendar`, "다음 급여일까지" for `income_day`.
   */
  cycleMode?: "calendar" | "income_day";
};

const STATUS_COPY: Record<SpendingStatus, { tone: string; label: string }> = {
  normal: { tone: "text-muted-foreground", label: "여유롭게 쓰는 중" },
  caution: { tone: "text-[color:var(--warning)]", label: "주의 구간" },
  warning: { tone: "text-[color:var(--warning)]", label: "위험 구간" },
  over: { tone: "text-destructive", label: "예산 초과" },
};

const STATUS_DOT: Record<SpendingStatus, string> = {
  normal: "bg-primary",
  caution: "bg-[color:var(--warning)]",
  warning: "bg-[color:var(--warning)]",
  over: "bg-destructive",
};

export function SpendingSummary({
  monthlyIncome,
  fixedExpense,
  monthlyExpense,
  extraIncome = 0,
  extraIncomeItems,
  cycleStartDate,
  cycleEndDate,
  hasSettings,
  friendView = false,
  showFixedBreakdown = false,
  cycleLabel,
  daysRemainingInCycle = null,
  cycleMode,
}: SpendingSummaryProps) {
  if (friendView) {
    // Friend mode: total spending number. When the owner granted fixed
    // visibility (showFixedBreakdown), the hero becomes the true total
    // (고정 + 변동) with a 고정/변동 breakdown line — both are already-permitted
    // aggregates, so no income/budget/rate leaks. Otherwise the hero stays
    // variable-only. The surrounding page composition tells the user what else
    // is hidden — no explicit disclaimer needed here.
    const friendHero = showFixedBreakdown
      ? fixedExpense + monthlyExpense
      : monthlyExpense;
    return (
      <Card className="rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
        <CardContent className="space-y-2 p-6">
          <p className="text-sm font-medium text-muted-foreground">총 소비</p>
          <p
            key={cycleLabel}
            className="text-[40px] font-bold leading-none tracking-[-0.045em] tabular-nums animate-in fade-in duration-200"
          >
            {formatNumber(friendHero)} 원
          </p>
          {showFixedBreakdown ? (
            <div className="flex items-center gap-3 pt-1 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-foreground/25"
                />
                고정 {formatKRW(fixedExpense)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-foreground/45"
                />
                변동 {formatKRW(monthlyExpense)}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const summary = calculateBudgetSummary({
    monthlyIncome,
    fixedExpense,
    monthlyExpense,
    extraIncome,
  });
  const status = getSpendingStatus(summary.spendingRate);
  const rateRounded = Math.round(summary.spendingRate);
  const isOver = summary.remainingBudget < 0;
  const hasExtraIncome = summary.extraIncome > 0;

  return (
    <Card className="rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
      <CardContent className="space-y-4 px-6 py-4">
        {!hasSettings ? (
          <Link
            href="/settings"
            className="block rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary"
          >
            월 수입과 고정지출을 먼저 설정해주세요 →
          </Link>
        ) : summary.monthlyIncome === 0 ? (
          <p className="text-sm text-muted-foreground">
            월 수입이 0원이에요. 설정에서 다시 확인해주세요.
          </p>
        ) : (
          <>
            <div
              key={cycleLabel}
              className="grid grid-cols-2 items-end gap-3 animate-in fade-in duration-200"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-[12px] text-muted-foreground">쓴 돈</p>
                <p className="text-[clamp(20px,6vw,32px)] font-extrabold leading-none tracking-[-0.04em] tabular-nums whitespace-nowrap">
                  {formatNumber(summary.totalSpent)}
                  <span className="ml-1 text-base font-semibold text-muted-foreground">
                    원
                  </span>
                </p>
              </div>
              <div className="min-w-0 space-y-1 text-right">
                <p
                  className={cn(
                    "text-[12px]",
                    isOver ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {isOver ? "초과" : "남은 돈"}
                </p>
                <p
                  className={cn(
                    "text-[clamp(16px,4.5vw,22px)] font-medium leading-none tabular-nums whitespace-nowrap",
                    isOver ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {formatNumber(Math.abs(summary.remainingBudget))}
                  <span
                    className={cn(
                      "ml-1 text-sm font-medium",
                      isOver ? "text-destructive/80" : "text-muted-foreground/80",
                    )}
                  >
                    원
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <SpendingProgress
                monthlyIncome={summary.effectiveIncome}
                fixedExpense={fixedExpense}
                monthlyExpense={monthlyExpense}
                status={status}
              />
              <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2 rounded-full bg-foreground/25"
                    />
                    고정 {formatKRW(fixedExpense)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className={cn("size-2 rounded-full", STATUS_DOT[status])}
                    />
                    소비 {formatKRW(monthlyExpense)}
                  </span>
                </div>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    STATUS_COPY[status].tone,
                  )}
                >
                  {rateRounded}% 사용
                </span>
              </div>
              {hasExtraIncome ? (
                extraIncomeItems && cycleStartDate && cycleEndDate ? (
                  <IncomeLine
                    items={extraIncomeItems}
                    totalAmount={summary.extraIncome}
                    cycleStartDate={cycleStartDate}
                    cycleEndDate={cycleEndDate}
                    cycleMode={cycleMode}
                  />
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    이번 {cycleMode === "income_day" ? "주기" : "달"} 추가 수입{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      +{formatNumber(summary.extraIncome)}원
                    </span>
                  </p>
                )
              ) : null}
              {status !== "normal" ? (
                <p className={cn("text-xs font-medium", STATUS_COPY[status].tone)}>
                  {STATUS_COPY[status].label}
                </p>
              ) : null}
            </div>

            {daysRemainingInCycle != null &&
            daysRemainingInCycle > 0 &&
            summary.remainingBudget > 0 ? (
              <div className="border-t border-dashed border-border pt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {cycleMode === "income_day"
                      ? "다음 급여일까지"
                      : "이번 달이 끝나기까지"}
                  </span>
                  <span className="text-xs text-foreground">
                    남은{" "}
                    <span className="font-semibold text-primary tabular-nums">
                      {daysRemainingInCycle}일
                    </span>{" "}
                    · 하루{" "}
                    <span className="font-semibold tabular-nums">
                      {formatNumber(
                        Math.floor(
                          summary.remainingBudget / daysRemainingInCycle,
                        ),
                      )}
                      원
                    </span>
                  </span>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
