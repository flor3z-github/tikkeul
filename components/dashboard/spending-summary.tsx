import Link from "next/link";

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
  hasSettings: boolean;
  /**
   * When true, render only the monthly expense total. Income, fixed expense,
   * available budget, and spending rate are hidden because they are private
   * to the data owner. Used when viewing a friend's dashboard.
   */
  friendView?: boolean;
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
  hasSettings,
  friendView = false,
  cycleLabel,
  daysRemainingInCycle = null,
  cycleMode,
}: SpendingSummaryProps) {
  if (friendView) {
    // Friend mode: render only the total spending number. The surrounding
    // page composition (presence/absence of the fixed-expense block, etc.)
    // tells the user what's hidden — no explicit disclaimer needed here.
    return (
      <Card className="rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
        <CardContent className="space-y-2 p-6">
          <p className="text-sm font-medium text-muted-foreground">총 소비</p>
          <p
            key={cycleLabel}
            className="text-[40px] font-bold leading-none tracking-[-0.045em] tabular-nums animate-in fade-in duration-200"
          >
            {formatNumber(monthlyExpense)} 원
          </p>
        </CardContent>
      </Card>
    );
  }

  const summary = calculateBudgetSummary({
    monthlyIncome,
    fixedExpense,
    monthlyExpense,
  });
  const status = getSpendingStatus(summary.spendingRate);
  const rateRounded = Math.round(summary.spendingRate);
  const isOver = summary.remainingBudget < 0;

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
              <div className="space-y-1">
                <p className="text-[12px] text-muted-foreground">쓴 돈</p>
                <p className="text-[clamp(22px,7.5vw,32px)] font-extrabold leading-none tracking-[-0.04em] tabular-nums whitespace-nowrap">
                  {formatNumber(summary.totalSpent)}
                  <span className="ml-1 text-base font-semibold text-muted-foreground">
                    원
                  </span>
                </p>
              </div>
              <div className="space-y-1">
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
                    "text-[22px] font-medium leading-none tabular-nums",
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
                monthlyIncome={monthlyIncome}
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
