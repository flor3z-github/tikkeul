import { redirect } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import {
  TransactionItem,
  type TransactionListRow,
} from "@/components/transactions/transaction-item";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import { getCategories } from "@/lib/queries/categories";
import { getMonthlyTransactions } from "@/lib/queries/transactions";
import { createClient } from "@/lib/supabase/server";
import { formatKoreanLongDate } from "@/lib/utils/calendar";
import { formatKRW } from "@/lib/utils/money";

type DayTransactionsSectionProps = {
  ym: string;
  day: string;
};

export async function DayTransactionsSection({
  ym,
  day,
}: DayTransactionsSectionProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) redirect("/login");

  const [monthlyResult, categoriesResult] = await Promise.all([
    getMonthlyTransactions(userId, ym),
    getCategories(userId),
  ]);

  if (!monthlyResult.ok) {
    return (
      <section className="mt-6">
        <div className="rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <p className="font-semibold">소비 내역을 불러오지 못했어요</p>
          <p className="break-all text-xs opacity-80">{monthlyResult.error}</p>
        </div>
      </section>
    );
  }

  if (!categoriesResult.ok) {
    return (
      <section className="mt-6">
        <div className="rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <p className="font-semibold">카테고리를 불러오지 못했어요</p>
          <p className="break-all text-xs opacity-80">
            {categoriesResult.error}
          </p>
        </div>
      </section>
    );
  }

  const dayRows: TransactionListRow[] = monthlyResult.transactions
    .filter((tx) => tx.spent_at.slice(0, 10) === day)
    .map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      category_id: tx.category_id,
      category_name: tx.category_name,
      category_icon: tx.category_icon,
      spent_at: tx.spent_at,
    }));

  const dayTotal = dayRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const label = formatKoreanLongDate(day);

  return (
    <>
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

        <Card className="rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
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
                      categories={categoriesResult.categories}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
      <AddTransactionButton
        categories={categoriesResult.categories}
        defaultDate={day}
      />
    </>
  );
}
