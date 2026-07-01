"use client";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/money";

const SHARES = [1, 2, 3, 4] as const;

type SplitChipsProps = {
  /**
   * Reference amount to divide. For catalog flows this is `default_amount`;
   * for the active-item edit flow we pass the catalog default too (not the
   * current user amount), so that pressing "/2" gives a stable result.
   */
  baseAmount: number;
  /** Current value in the amount input. Used to highlight matching chip. */
  currentValue: number;
  /** `next` = baseAmount/n (rounded). `people` = the chosen N (1 = 혼자 다). The
   *  transaction split flow needs N to persist split_count; the fixed-expense
   *  callers pass a 1-arg handler and ignore it (safe param-count widening). */
  onPick: (next: number, people: number) => void;
};

/**
 * Shared subscriptions (Netflix, YouTube Premium, etc.) are often split among
 * a few people. These chips compute baseAmount / N and set the amount input
 * for quick entry. Stored as a single amount — we don't persist N.
 */
export function SplitChips({
  baseAmount,
  currentValue,
  onPick,
}: SplitChipsProps) {
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {SHARES.map((n) => {
        const computed = Math.round(baseAmount / n);
        const active = currentValue === computed;
        const label = n === 1 ? "혼자 다" : `${n}명`;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onPick(computed, n)}
            aria-pressed={active}
            className={cn(
              "h-9 rounded-full border px-3 text-xs font-medium tabular-nums transition-all duration-150 ease-out",
              "active:scale-[0.98]",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            <span>{label}</span>
            <span
              className={cn(
                "ml-1.5 text-[11px]",
                active ? "text-primary/80" : "text-muted-foreground",
              )}
            >
              {formatNumber(computed)}원
            </span>
          </button>
        );
      })}
    </div>
  );
}
