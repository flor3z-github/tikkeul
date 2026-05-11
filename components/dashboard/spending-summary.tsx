import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
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
            가용 예산이 0원이에요. 설정에서 월 수입을 다시 확인해주세요.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <SpendingProgress rate={summary.spendingRate} status={status} />
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
              <p className="text-xs text-muted-foreground">
                {STATUS_COPY[status].label} · 남은 예산{" "}
                <span className="font-medium text-foreground">
                  {formatKRW(Math.max(0, summary.remainingBudget))}
                </span>
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
