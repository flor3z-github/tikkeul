"use client";

import { DayCell } from "./day-cell";
import {
  buildCycleMatrix,
  buildMonthMatrix,
  classifyDailyAmount,
  type CycleMode,
} from "@/lib/utils/calendar";

type SpendingMonthGridProps = {
  ym: string;
  cycleStart: Date;
  cycleEnd: Date;
  cycleMode: CycleMode;
  selectedDay: string;
  dailyTotals: Record<string, number>;
  availableBudget: number;
  /** Own-mode: set of YYYY-MM-DD with at least one scheduled fixed expense.
   *  Drives a small marker under the day number. */
  fixedExpenseDays?: Set<string>;
  onSelectDay: (iso: string) => void;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

type NormalizedCell =
  | {
      kind: "day";
      date: Date;
      iso: string;
      isToday: boolean;
      inCycle: boolean;
    }
  | { kind: "empty" };

function calendarCells(ym: string): NormalizedCell[] {
  return buildMonthMatrix(ym).map((cell) => ({
    kind: "day" as const,
    date: cell.date,
    iso: cell.iso,
    isToday: cell.isToday,
    // In calendar mode "inCycle" is equivalent to "inMonth" — same visual.
    inCycle: cell.inMonth,
  }));
}

function cycleCells(cycleStart: Date, cycleEnd: Date): NormalizedCell[] {
  return buildCycleMatrix(cycleStart, cycleEnd).map((cell) =>
    cell.kind === "empty"
      ? { kind: "empty" as const }
      : {
          kind: "day" as const,
          date: cell.date,
          iso: cell.iso,
          isToday: cell.isToday,
          inCycle: true,
        },
  );
}

export function SpendingMonthGrid({
  ym,
  cycleStart,
  cycleEnd,
  cycleMode,
  selectedDay,
  dailyTotals,
  availableBudget,
  fixedExpenseDays,
  onSelectDay,
}: SpendingMonthGridProps) {
  const cells: NormalizedCell[] =
    cycleMode === "income_day"
      ? cycleCells(cycleStart, cycleEnd)
      : calendarCells(ym);

  return (
    <div className="space-y-2">
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
          if (cell.kind === "empty") {
            return (
              <div
                key={`empty-${i}`}
                aria-hidden
                className="h-[clamp(3.75rem,14vw,4rem)] min-h-11"
              />
            );
          }
          const amount = dailyTotals[cell.iso] ?? 0;
          const state = classifyDailyAmount(amount, availableBudget);
          const isSelected = cell.inCycle && cell.iso === selectedDay;
          const hasFixedExpense = fixedExpenseDays?.has(cell.iso) === true;
          return (
            <DayCell
              key={`${cell.iso}-${i}`}
              day={cell.date.getDate()}
              amount={amount}
              state={state}
              inMonth={cell.inCycle}
              isToday={cell.isToday}
              isSelected={isSelected}
              hasFixedExpense={hasFixedExpense}
              onClick={() => {
                if (!cell.inCycle) return;
                if (cell.iso === selectedDay) return;
                onSelectDay(cell.iso);
              }}
              ariaLabel={`${cell.date.getMonth() + 1}월 ${cell.date.getDate()}일${amount > 0 ? `, 소비 ${amount.toLocaleString()}원` : ""}${hasFixedExpense ? ", 고정지출 예정" : ""}`}
            />
          );
        })}
      </div>
    </div>
  );
}
