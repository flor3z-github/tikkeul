"use client";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/money";
import type { DayState } from "@/lib/utils/calendar";

type DayCellProps = {
  day: number;
  amount: number;
  state: DayState;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
  ariaLabel: string;
};

const AMOUNT_TONE: Record<DayState, string> = {
  none: "",
  normal: "text-foreground/70",
  warning: "text-[color:var(--warning)]",
  danger: "text-destructive",
};

export function DayCell({
  day,
  amount,
  state,
  inMonth,
  isToday,
  isSelected,
  onClick,
  ariaLabel,
}: DayCellProps) {
  if (!inMonth) {
    return <div aria-hidden className="h-12" />;
  }

  const dayTone = isSelected
    ? "text-primary-foreground"
    : amount > 0
      ? "text-foreground"
      : "text-muted-foreground";

  const amountTone = isSelected ? "text-primary-foreground/85" : AMOUNT_TONE[state];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      className="flex h-12 items-stretch justify-center p-0.5 transition-transform active:scale-[0.96]"
    >
      <span
        className={cn(
          "flex w-full flex-col items-center justify-start gap-1 rounded-2xl py-0.5 transition-colors",
          isSelected ? "bg-primary" : "hover:bg-muted",
        )}
      >
        <span
          className={cn(
            "flex h-6 min-w-6 items-center justify-center rounded-full text-[13px] font-semibold leading-none tabular-nums",
            isToday && !isSelected ? "bg-primary text-primary-foreground" : dayTone,
          )}
        >
          {day}
        </span>
        {amount > 0 ? (
          <span
            className={cn(
              "text-[9px] font-medium leading-tight tabular-nums",
              amountTone,
            )}
          >
            {formatNumber(amount)}
          </span>
        ) : null}
      </span>
    </button>
  );
}
