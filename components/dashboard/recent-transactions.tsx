import { Card, CardContent } from "@/components/ui/card";
import {
  TransactionItem,
  type TransactionListRow,
} from "@/components/transactions/transaction-item";
import type { TransactionFormCategory } from "@/components/transactions/transaction-form-dialog";

type RecentTransactionsProps = {
  transactions: TransactionListRow[];
  categories: TransactionFormCategory[];
};

export function RecentTransactions({
  transactions,
  categories,
}: RecentTransactionsProps) {
  return (
    <section className="mt-6 space-y-3">
      <h2 className="px-1 text-[15px] font-semibold tracking-[-0.015em]">
        최근 소비
      </h2>

      <Card className="rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
        <CardContent className="p-2">
          {transactions.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              아직 추가한 소비가 없어요.
              <br />
              오른쪽 아래 + 버튼으로 첫 소비를 기록해보세요.
            </p>
          ) : (
            <ul className="space-y-1">
              {transactions.map((transaction) => (
                <li key={transaction.id}>
                  <TransactionItem
                    transaction={transaction}
                    categories={categories}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
