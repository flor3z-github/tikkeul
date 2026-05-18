"use client";

import { useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { SpendingMonthGrid } from "@/components/calendar/spending-month-grid";
import { MonthSwitcher } from "@/app/dashboard/_components/month-switcher";
import {
  TransactionItem,
  type TransactionListRow,
} from "@/components/transactions/transaction-item";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import type { TransactionFormCategory } from "@/components/transactions/transaction-form-dialog";
import type { MonthlyTransaction } from "@/lib/queries/transactions";
import {
  type CycleMode,
  formatKoreanLongDate,
} from "@/lib/utils/calendar";
import { toISODate } from "@/lib/utils/date";
import { formatKRW } from "@/lib/utils/money";

type CalendarDayPanelProps = {
  ym: string;
  initialDay: string;
  cycleStart: Date;
  cycleEnd: Date;
  cycleMode: CycleMode;
  cycleLabel: string;
  transactions: MonthlyTransaction[];
  categories: TransactionFormCategory[];
  availableBudget: number;
  /** Current viewer's user_id — passed through to the interaction sheet. */
  viewerId: string;
  /**
   * True when the user is viewing their own dashboard. Controls whether the
   * add-transaction FAB renders and is forwarded to the interaction sheet so
   * the owner sees the "수정" button.
   */
  isOwn: boolean;
  /** display_name lookup for the owner + all friends in scope. */
  nicknameById: Map<string, string>;
};

export function CalendarDayPanel({
  ym,
  initialDay,
  cycleStart,
  cycleEnd,
  cycleMode,
  cycleLabel,
  transactions,
  categories,
  availableBudget,
  viewerId,
  isOwn,
  nicknameById,
}: CalendarDayPanelProps) {
  const [selectedDay, setSelectedDay] = useState(initialDay);

  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const tx of transactions) {
      const day = toISODate(new Date(tx.spent_at));
      totals[day] = (totals[day] ?? 0) + Number(tx.amount);
    }
    return totals;
  }, [transactions]);

  const dayRows: TransactionListRow[] = useMemo(
    () =>
      transactions
        .filter((tx) => toISODate(new Date(tx.spent_at)) === selectedDay)
        .map((tx) => ({
          id: tx.id,
          amount: tx.amount,
          category_id: tx.category_id,
          category_name: tx.category_name,
          category_icon: tx.category_icon,
          spent_at: tx.spent_at,
          memo: tx.memo,
          reactions: tx.reactions,
          comments: tx.comments,
        })),
    [transactions, selectedDay],
  );

  const dayTotal = dayRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const label = formatKoreanLongDate(selectedDay);

  return (
    <>
      <div className="mt-3 space-y-1.5 rounded-3xl border border-black/[0.08] bg-card p-3 dark:border-white/[0.10]">
        <MonthSwitcher ym={ym} cycleLabel={cycleLabel} />
        <SpendingMonthGrid
          ym={ym}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
          cycleMode={cycleMode}
          selectedDay={selectedDay}
          dailyTotals={dailyTotals}
          availableBudget={availableBudget}
          onSelectDay={setSelectedDay}
        />
      </div>

      <section className="mt-6 space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[15px] font-semibold tracking-[-0.015em]">
            {label}
          </h2>
          {dayTotal > 0 ? (
            <span className="text-[13px] font-semibold tabular-nums text-muted-foreground">
              {formatKRW(dayTotal)}
            </span>
          ) : null}
        </div>

        <Card className="rounded-3xl border-black/[0.08] bg-card py-2 shadow-none dark:border-white/[0.10]">
          <CardContent className="p-2">
            {dayRows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                이 날 기록된 소비가 없어요.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {dayRows.map((transaction) => (
                  <li key={transaction.id}>
                    <TransactionItem
                      transaction={transaction}
                      categories={categories}
                      viewerId={viewerId}
                      isOwn={isOwn}
                      nicknameById={nicknameById}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {isOwn ? (
        <AddTransactionButton
          categories={categories}
          defaultDate={selectedDay}
        />
      ) : null}
    </>
  );
}
