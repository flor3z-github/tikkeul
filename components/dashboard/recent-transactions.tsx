import { Card, CardContent } from "@/components/ui/card";
import {
  TransactionItem,
  type TransactionListRow,
} from "@/components/transactions/transaction-item";
import type { TransactionFormCategory } from "@/components/transactions/transaction-form-dialog";
import { formatRelativeKoreanDate } from "@/lib/utils/date";

type RecentTransactionsProps = {
  transactions: TransactionListRow[];
  categories: TransactionFormCategory[];
};

type DateGroup = {
  date: string;
  transactions: TransactionListRow[];
};

function groupByDate(transactions: TransactionListRow[]): DateGroup[] {
  const groups: DateGroup[] = [];
  let current: DateGroup | null = null;
  for (const tx of transactions) {
    const date = tx.spent_at.slice(0, 10);
    if (!current || current.date !== date) {
      current = { date, transactions: [] };
      groups.push(current);
    }
    current.transactions.push(tx);
  }
  return groups;
}

export function RecentTransactions({
  transactions,
  categories,
}: RecentTransactionsProps) {
  const groups = groupByDate(transactions);

  return (
    <section className="mt-6 space-y-3">
      <h2 className="px-1 text-[15px] font-semibold tracking-[-0.015em]">
        최근 소비
      </h2>

      <Card className="rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
        <CardContent className="p-2">
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              아직 추가한 소비가 없어요.
              <br />
              오른쪽 아래 + 버튼으로 첫 소비를 기록해보세요.
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.date}>
                  <h3 className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                    {formatRelativeKoreanDate(group.date)}
                  </h3>
                  <ul className="space-y-0.5">
                    {group.transactions.map((transaction) => (
                      <li key={transaction.id}>
                        <TransactionItem
                          transaction={transaction}
                          categories={categories}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
