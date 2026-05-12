import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatKRW } from "@/lib/utils/money";
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
}: SpendingSummaryProps) {
  const summary = calculateBudgetSummary({
    monthlyIncome,
    fixedExpense,
    monthlyExpense,
  });
  const status = getSpendingStatus(summary.spendingRate);
  const rateRounded = Math.round(summary.spendingRate);

  return (
    <Card className="rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
      <CardContent className="space-y-4 p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            이번 달 소비
          </p>
          <p className="text-[40px] font-bold leading-none tracking-[-0.045em] tabular-nums">
            {formatKRW(monthlyExpense)}
          </p>
        </div>

        {!hasSettings ? (
          <Link
            href="/settings"
            className="block rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary"
          >
            월 수입과 고정지출을 먼저 설정해주세요 →
          </Link>
        ) : summary.availableBudget === 0 ? (
          <p className="text-sm text-muted-foreground">
            가용 예산이 0원이에요. 월 수입을 다시 확인해주세요.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <SpendingProgress
                monthlyIncome={monthlyIncome}
                fixedExpense={fixedExpense}
                monthlyExpense={monthlyExpense}
                status={status}
              />
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2 rounded-full bg-foreground/25"
                  />
                  고정지출
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn("size-2 rounded-full", STATUS_DOT[status])}
                  />
                  이번 달 소비
                </span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  가용 예산{" "}
                  <span className="font-medium text-foreground">
                    {formatKRW(summary.availableBudget)}
                  </span>{" "}
                  중
                </span>
                <span
                  className={`font-semibold tabular-nums ${STATUS_COPY[status].tone}`}
                >
                  {rateRounded}% 사용
                </span>
              </div>
              {summary.remainingBudget >= 0 ? (
                <p className="text-xs text-muted-foreground">
                  {STATUS_COPY[status].label} · 남은 예산{" "}
                  <span className="font-medium text-foreground">
                    {formatKRW(summary.remainingBudget)}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-destructive">
                  {STATUS_COPY[status].label} · 예산을{" "}
                  <span className="font-semibold">
                    {formatKRW(Math.abs(summary.remainingBudget))}
                  </span>{" "}
                  초과했어요
                </p>
              )}
            </div>
          </>
        )}

        {hasSettings ? (
          <dl className="space-y-1.5 border-t border-border pt-4 text-[12px]">
            <SummaryRow label="월 수입" value={formatKRW(monthlyIncome)} />
            <SummaryRow label="고정지출" value={formatKRW(fixedExpense)} />
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
