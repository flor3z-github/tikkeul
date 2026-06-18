import { cn } from "@/lib/utils";
import type { SpendingStatus } from "@/lib/utils/budget";

type SpendingProgressProps = {
  monthlyIncome: number;
  fixedExpense: number;
  monthlyExpense: number;
  /**
   * This-cycle savings/investment (돈모으기). When > 0, a leading green segment
   * is added and the bar becomes a 3-split (모으기/고정/소비). 0 → 2-split, i.e.
   * byte-identical to the pre-savings bar. Defaults to 0.
   */
  savings?: number;
  status: SpendingStatus;
};

const STATUS_BAR_COLOR: Record<SpendingStatus, string> = {
  normal: "bg-primary",
  caution: "bg-[color:var(--warning)]",
  warning: "bg-[color:var(--warning)]",
  over: "bg-destructive",
};

/**
 * Stacked bar: monthlyIncome is the denominator. Segments, in order, are
 * savings (green, asset — only when > 0), fixed expenses (neutral), and the
 * current cycle's variable spending (status-tinted). The remainder is bg-muted.
 *
 * The bar always sums to <= 100% visually. If the segments exceed income
 * (savings + fixed + spending > income), all are scaled proportionally so they
 * stay in correct ratio relative to one another.
 */
export function SpendingProgress({
  monthlyIncome,
  fixedExpense,
  monthlyExpense,
  savings = 0,
  status,
}: SpendingProgressProps) {
  const income = Math.max(0, monthlyIncome);
  const save = Math.max(0, savings);
  const fixed = Math.max(0, fixedExpense);
  const spend = Math.max(0, monthlyExpense);

  let savePct = 0;
  let fixedPct = 0;
  let spendPct = 0;
  if (income > 0) {
    savePct = (save / income) * 100;
    fixedPct = (fixed / income) * 100;
    spendPct = (spend / income) * 100;
    const total = savePct + fixedPct + spendPct;
    if (total > 100) {
      const scale = 100 / total;
      savePct *= scale;
      fixedPct *= scale;
      spendPct *= scale;
    }
  }

  // aria-valuenow reflects the *spending* portion of income (consumption rate) —
  // keeps semantics aligned with the visible "X%" badge on the 소비 legend line,
  // not the fuller bar (which includes savings + fixed).
  const ariaValue = Math.round(
    income > 0 ? Math.min(100, (spend / income) * 100) : 0,
  );

  return (
    <div
      role="progressbar"
      aria-valuenow={ariaValue}
      aria-valuemin={0}
      aria-valuemax={100}
      className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
    >
      {save > 0 ? (
        <div
          className="h-full bg-[#1c8c4d] transition-[width,background-color] duration-500 ease-out"
          style={{ width: `${savePct}%` }}
        />
      ) : null}
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
