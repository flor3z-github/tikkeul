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
      className={cn(
        "flex h-12 flex-col items-center justify-center gap-1 rounded-xl px-0.5 transition-colors",
        "active:scale-[0.96]",
        isSelected
          ? "bg-primary"
          : isToday
            ? "ring-1 ring-primary/70 ring-inset"
            : "hover:bg-muted",
      )}
    >
      <span
        className={cn("text-[13px] font-semibold leading-tight tabular-nums", dayTone)}
      >
        {day}
      </span>
      {amount > 0 ? (
        <span
          className={cn(
            "text-[10px] font-medium leading-tight tabular-nums",
            amountTone,
          )}
        >
          {formatNumber(amount)}
        </span>
      ) : null}
    </button>
  );
}
