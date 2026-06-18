import Link from "next/link";
import { ChevronRight, PieChart, TrendingDown, TrendingUp } from "lucide-react";

import { IncomeLine, type IncomeLineItem } from "@/components/income/income-line";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatKRW, formatNumber } from "@/lib/utils/money";
import {
  calculateBudgetSummary,
  getSpendingStatus,
  type SpendingStatus,
} from "@/lib/utils/budget";
import { spendTrend } from "@/lib/utils/stats/trend";
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
  /**
   * When provided, the card becomes a tappable entry point to the stats screen
   * (§12.9) via a stretched-link overlay. The caller passes this ONLY in own
   * mode for the CURRENT cycle — friend mode and past/future cycles omit it so
   * the stats total always matches the number this card shows.
   */
  statsHref?: string;
  /**
   * 총액 추세 델타(원, 이번 − 지난 주기 같은 때). 양수 = 더 씀. 고정은
   * matched-only(fixedDelta), 변동은 같은 경과 시점 클램프로 정직하게 합산된 값
   * (§3.3, lib/utils/stats/trend.ts). undefined면 추세 블록을 숨긴다 — 호출부는
   * own + 현재 주기 + 직전 주기에 실거래가 있었을 때만(hasPrevBaseline) 넘긴다.
   */
  trendDeltaWon?: number;
};

// 인라인 rate 라벨용 짧은 상태어. normal은 단어 없이 % 만 표기.
const STATUS_SHORT: Record<SpendingStatus, string> = {
  normal: "",
  caution: "주의",
  warning: "위험",
  over: "초과",
};

// rate 텍스트 색. 밝은 --warning(#ff9500)은 흰 배경 텍스트 대비 미달이라
// 텍스트용은 진한 주황(#b45309, AA 통과). 바 채움은 --warning 유지(spending-progress).
const STATUS_RATE_TONE: Record<SpendingStatus, string> = {
  normal: "text-muted-foreground",
  caution: "text-[#b45309]",
  warning: "text-[#b45309]",
  over: "text-destructive",
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
  statsHref,
  trendDeltaWon,
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

  // 총액 추세 한 줄(§12.2): 숫자만 강조하고 방향 아이콘을 붙이려고 파트로 분해.
  // 색은 budget 상태색과 충돌하지 않게 중립으로 둔다(더/덜 = 단어 + 아이콘 모양으로만).
  const trend =
    trendDeltaWon != null
      ? spendTrend(trendDeltaWon, cycleMode === "income_day" ? "주기" : "달")
      : null;

  // Stats entry overlay: only in the populated hero state. The !hasSettings and
  // monthlyIncome===0 branches render their own inner <Link>/CTA, and stats has
  // nothing to show without a budget — gating here also avoids nesting links.
  const showStatsOverlay =
    Boolean(statsHref) && hasSettings && summary.monthlyIncome !== 0;

  const hasDailyBudget =
    daysRemainingInCycle != null &&
    daysRemainingInCycle > 0 &&
    summary.remainingBudget > 0;

  return (
    <Card className="relative rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
      {showStatsOverlay ? (
        <Link
          href={statsHref!}
          aria-label="소비 구성 통계 보기"
          className="absolute inset-0 z-10 rounded-3xl [-webkit-tap-highlight-color:transparent]"
        />
      ) : null}
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
            {/* 결과 그룹: 라벨 + 색칠 추세칩 + 단일 총액 */}
            <div
              key={cycleLabel}
              className="space-y-3 animate-in fade-in duration-200"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="pt-0.5 text-[13px] font-medium text-muted-foreground">
                  {cycleMode === "income_day" ? "이번 주기 쓴 돈" : "이번 달 쓴 돈"}
                </p>
                {trend && trend.kind !== "flat" ? (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold",
                      trend.kind === "down"
                        ? "bg-[#e8f7ee] text-[#1c8c4d]"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {trend.kind === "down" ? (
                      <TrendingDown aria-hidden className="size-3 shrink-0" />
                    ) : (
                      <TrendingUp aria-hidden className="size-3 shrink-0" />
                    )}
                    {trend.amount} {trend.kind === "down" ? "덜 씀" : "더 씀"}
                  </span>
                ) : null}
              </div>
              <p className="text-[38px] font-extrabold leading-none tracking-[-0.03em] tabular-nums whitespace-nowrap">
                {formatNumber(summary.totalSpent)}
                <span className="ml-1 text-lg font-bold text-foreground">원</span>
              </p>
            </div>

            {/* 예산 바 + 범례 + rate */}
            <div className="space-y-2.5">
              <SpendingProgress
                monthlyIncome={summary.effectiveIncome}
                fixedExpense={fixedExpense}
                monthlyExpense={monthlyExpense}
                status={status}
              />
              <div className="flex items-center justify-between gap-2 text-[11.5px] tabular-nums">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
                    <span
                      aria-hidden
                      className="size-[7px] shrink-0 rounded-full bg-foreground/25"
                    />
                    고정{" "}
                    <b className="font-semibold text-[#3a3a3c]">
                      {formatNumber(fixedExpense)}원
                    </b>
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
                    <span
                      aria-hidden
                      className={cn(
                        "size-[7px] shrink-0 rounded-full",
                        STATUS_DOT[status],
                      )}
                    />
                    소비{" "}
                    <b className="font-semibold text-[#3a3a3c]">
                      {formatNumber(monthlyExpense)}원
                    </b>
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-bold tabular-nums",
                    STATUS_RATE_TONE[status],
                  )}
                >
                  {rateRounded}%
                  {STATUS_SHORT[status] ? ` · ${STATUS_SHORT[status]}` : ""}
                </span>
              </div>
              {hasExtraIncome ? (
                <div className="relative z-20">
                  {extraIncomeItems && cycleStartDate && cycleEndDate ? (
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
                  )}
                </div>
              ) : null}
            </div>

            {/* 점선 구분선 (인셋, 앱 기본 divider: border-dashed border-border) */}
            <div className="border-t border-dashed border-border" />

            {/* 2분할: 남은 돈 | 하루 쓸 수 있는 돈 */}
            <div className="flex items-stretch">
              <div className="flex-1 space-y-1">
                <p
                  className={cn(
                    "text-[12px] font-medium",
                    isOver ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {isOver ? "초과" : "남은 돈"}
                </p>
                <p
                  className={cn(
                    "text-[19px] font-bold leading-none tabular-nums",
                    isOver ? "text-destructive" : "text-foreground",
                  )}
                >
                  {formatNumber(Math.abs(summary.remainingBudget))}
                  <span
                    className={cn(
                      "ml-0.5 text-[13px] font-semibold",
                      isOver ? "text-destructive/80" : "text-muted-foreground",
                    )}
                  >
                    원
                  </span>
                </p>
              </div>
              <div className="my-0.5 self-stretch border-l border-dashed border-border" />
              <div className="flex-[1.2] space-y-1 pl-[18px]">
                <p className="text-[12px] font-medium text-muted-foreground">
                  하루 쓸 수 있는 돈
                  {hasDailyBudget ? (
                    <span className="text-primary"> · {daysRemainingInCycle}일 남음</span>
                  ) : null}
                </p>
                {hasDailyBudget ? (
                  <p className="text-[19px] font-bold leading-none tabular-nums text-primary">
                    {formatNumber(
                      Math.floor(summary.remainingBudget / daysRemainingInCycle!),
                    )}
                    <span className="ml-0.5 text-[13px] font-semibold text-primary">
                      원
                    </span>
                  </p>
                ) : (
                  <p className="text-[19px] font-bold leading-none text-muted-foreground/50">
                    —
                  </p>
                )}
              </div>
            </div>

            {/* 소비 구성 보기 (affordance only; 카드 전체가 stretched-link) */}
            {showStatsOverlay ? (
              <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-3 py-2.5 text-[13px] font-semibold text-[#3a3a3c]">
                <PieChart className="size-[15px] shrink-0 text-primary" />
                <span>소비 구성 보기</span>
                <ChevronRight className="ml-auto size-3.5 shrink-0 text-muted-foreground/50" />
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
