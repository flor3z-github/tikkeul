"use client";

import { DayCell } from "./day-cell";
import {
  buildCycleMatrix,
  buildMonthMatrix,
  classifyDailyAmount,
  shouldShowMonthLabel,
  type CycleMode,
} from "@/lib/utils/calendar";
import { toISODate } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/money";

type SpendingMonthGridProps = {
  ym: string;
  cycleStart: Date;
  cycleEnd: Date;
  cycleMode: CycleMode;
  selectedDay: string;
  dailyTotals: Record<string, number>;
  /** Daily-classification baseline: the cycle's full inflow pool (income +
   *  추가수입). Fixed expenses are folded into `dailyTotals`, so this is NOT
   *  income − fixed (would double-count). 0 in friend mode → all cells normal. */
  cycleBudget: number;
  /** Own-mode: set of YYYY-MM-DD with at least one scheduled fixed expense.
   *  Drives a small marker under the day number. */
  fixedExpenseDays?: Set<string>;
  /** Own-mode: set of YYYY-MM-DD with at least one savings deposit. Drives a
   *  green marker beside the fixed one; NOT folded into `dailyTotals`. */
  savingsDays?: Set<string>;
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
  cycleBudget,
  fixedExpenseDays,
  savingsDays,
  onSelectDay,
}: SpendingMonthGridProps) {
  const cells: NormalizedCell[] =
    cycleMode === "income_day"
      ? cycleCells(cycleStart, cycleEnd)
      : calendarCells(ym);

  // In cycle (income_day) mode a single cycle can span two months (e.g. a 말일
  // cycle running 5/30–6/30). We surface "M/D" only on month-boundary cells —
  // the very first day cell (cycleStart, anchors the starting month) and every
  // day-1 cell (where the month rolls over) — so the grid reads e.g.
  // "5/30 · 31 · 6/1 · 2 · 3". Every other cell shows the bare day.
  // Calendar mode (single month) never carries a month prefix.
  const cycleStartIso = toISODate(cycleStart);

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
          const state = classifyDailyAmount(amount, cycleBudget);
          const isSelected = cell.inCycle && cell.iso === selectedDay;
          const hasFixedExpense = fixedExpenseDays?.has(cell.iso) === true;
          const hasSavings = savingsDays?.has(cell.iso) === true;
          const isMonthBoundary = shouldShowMonthLabel(
            cell.iso,
            cycleStartIso,
            cycleMode,
          );
          return (
            <DayCell
              key={`${cell.iso}-${i}`}
              day={cell.date.getDate()}
              month={isMonthBoundary ? cell.date.getMonth() + 1 : undefined}
              amount={amount}
              state={state}
              inMonth={cell.inCycle}
              isToday={cell.isToday}
              isSelected={isSelected}
              hasFixedExpense={hasFixedExpense}
              hasSavings={hasSavings}
              onClick={() => {
                if (!cell.inCycle) return;
                if (cell.iso === selectedDay) return;
                onSelectDay(cell.iso);
              }}
              ariaLabel={`${cell.date.getMonth() + 1}월 ${cell.date.getDate()}일${amount > 0 ? `, 소비 ${formatNumber(amount)}원` : ""}${hasFixedExpense ? ", 고정지출 예정" : ""}${hasSavings ? ", 저축 예정" : ""}`}
            />
          );
        })}
      </div>
    </div>
  );
}
