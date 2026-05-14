import { cn } from "@/lib/utils";
import type { SpendingStatus } from "@/lib/utils/budget";

type SpendingProgressProps = {
  monthlyIncome: number;
  fixedExpense: number;
  monthlyExpense: number;
  status: SpendingStatus;
};

const STATUS_BAR_COLOR: Record<SpendingStatus, string> = {
  normal: "bg-primary",
  caution: "bg-[color:var(--warning)]",
  warning: "bg-[color:var(--warning)]",
  over: "bg-destructive",
};

/**
 * Stacked bar: monthlyIncome is the denominator. Fixed expenses fill the
 * leading segment (neutral tone) and the current month's variable spending
 * fills the next segment (status-tinted). The remainder is bg-muted.
 *
 * The bar always sums to <= 100% visually. If the totals exceed monthly
 * income (fixed + spending > income), each segment is scaled proportionally
 * so the segments stay in correct ratio relative to one another.
 */
export function SpendingProgress({
  monthlyIncome,
  fixedExpense,
  monthlyExpense,
  status,
}: SpendingProgressProps) {
  const income = Math.max(0, monthlyIncome);
  const fixed = Math.max(0, fixedExpense);
  const spend = Math.max(0, monthlyExpense);

  let fixedPct = 0;
  let spendPct = 0;
  if (income > 0) {
    fixedPct = (fixed / income) * 100;
    spendPct = (spend / income) * 100;
    const total = fixedPct + spendPct;
    if (total > 100) {
      const scale = 100 / total;
      fixedPct *= scale;
      spendPct *= scale;
    }
  }

  // aria-valuenow reflects the *spending* portion of the income — keeps
  // semantics aligned with the visible "X% 사용" label nearby.
  const ariaValue = Math.round(
    income > 0 ? Math.min(100, (spend / income) * 100) : 0,
  );

  return (
    <div
      role="progressbar"
      aria-valuenow={ariaValue}
      aria-valuemin={0}
      aria-valuemax={100}
      className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full bg-foreground/25 transition-[width,background-color] duration-500 ease-out"
        style={{ width: `${fixedPct}%` }}
      />
      <div
        className={cn(
          "h-full transition-[width,background-color] duration-500 ease-out",
          STATUS_BAR_COLOR[status],
        )}
        style={{ width: `${spendPct}%` }}
      />
    </div>
  );
}
