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
  const hasAmount = amount > 0;

  if (!inMonth) {
    return (
      <div
        aria-hidden
        className="h-[clamp(3.75rem,14vw,4rem)] min-h-11"
      />
    );
  }

  const dayTone = isSelected
    ? "text-primary-foreground"
    : hasAmount
      ? "text-foreground"
      : "text-muted-foreground";

  const amountTone = isSelected ? "text-primary-foreground/85" : AMOUNT_TONE[state];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      className="flex h-[clamp(3.75rem,14vw,4rem)] min-h-11 min-w-0 items-stretch justify-center p-px transition-transform active:scale-[0.96]"
    >
      <span
        className={cn(
          "flex h-full min-w-0 flex-col items-center justify-start gap-0.5 rounded-[16px] pb-2 pt-2 transition-colors",
          isSelected
            ? "-mx-0.5 w-[calc(100%+0.25rem)] bg-primary px-0.5"
            : hasAmount
              ? "w-full px-1 hover:bg-muted"
              : "w-full px-1 hover:bg-muted",
        )}
      >
        <span
          className={cn(
            "flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[13px] font-semibold leading-none tabular-nums",
            isToday && !isSelected ? "bg-primary text-primary-foreground" : dayTone,
          )}
        >
          {day}
        </span>
        {hasAmount ? (
          <span
            className={cn(
              "block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(0.46875rem,2vw,0.5625rem)] font-medium leading-none tabular-nums",
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
