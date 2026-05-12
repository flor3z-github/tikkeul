"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { DayCell } from "./day-cell";
import {
  buildMonthMatrix,
  classifyDailyAmount,
  type MonthCell,
} from "@/lib/utils/calendar";

type SpendingMonthGridProps = {
  ym: string;
  selectedDay: string;
  dailyTotals: Record<string, number>;
  availableBudget: number;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function SpendingMonthGrid({
  ym,
  selectedDay,
  dailyTotals,
  availableBudget,
}: SpendingMonthGridProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const cells = buildMonthMatrix(ym);

  function handleSelect(cell: MonthCell) {
    if (!cell.inMonth) return;
    if (cell.iso === selectedDay) return;
    const next = `/dashboard?ym=${ym}&day=${cell.iso}`;
    startTransition(() => {
      router.push(next, { scroll: false });
    });
  }

  return (
    <div
      data-pending={pending ? "true" : undefined}
      className="space-y-2"
    >
      <div className="grid grid-cols-7 gap-x-1 px-0.5 pb-1.5 text-[11px] font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((label, index) => (
          <span
            key={label}
            className="flex h-5 items-center justify-center"
            style={
              index === 0
                ? { color: "var(--destructive)" }
                : index === 6
                  ? { color: "var(--primary)" }
                  : undefined
            }
          >
            {label}
          </span>
        ))}
      </div>
      <div className="grid min-w-0 grid-cols-7 gap-x-1 gap-y-0.5">
        {cells.map((cell, i) => {
          const amount = dailyTotals[cell.iso] ?? 0;
          const state = classifyDailyAmount(amount, availableBudget);
          const isSelected = cell.inMonth && cell.iso === selectedDay;
          return (
            <DayCell
              key={`${cell.iso}-${i}`}
              day={cell.date.getDate()}
              amount={amount}
              state={state}
              inMonth={cell.inMonth}
              isToday={cell.isToday}
              isSelected={isSelected}
              onClick={() => handleSelect(cell)}
              ariaLabel={`${cell.date.getMonth() + 1}월 ${cell.date.getDate()}일${amount > 0 ? `, 소비 ${amount.toLocaleString()}원` : ""}`}
            />
          );
        })}
      </div>
    </div>
  );
}
