"use client";

import { useState } from "react";

import { CategoryIcon } from "@/lib/utils/category-icon";
import { formatKRW } from "@/lib/utils/money";
import {
  TransactionFormDialog,
  type TransactionFormCategory,
  type TransactionFormInitial,
} from "./transaction-form-dialog";

export type TransactionListRow = {
  id: string;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  spent_at: string;
};

type TransactionItemProps = {
  transaction: TransactionListRow;
  categories: TransactionFormCategory[];
};

export function TransactionItem({
  transaction,
  categories,
}: TransactionItemProps) {
  const [open, setOpen] = useState(false);

  const initial: TransactionFormInitial = {
    id: transaction.id,
    amount: Number(transaction.amount),
    category_id: transaction.category_id,
    spent_at: transaction.spent_at,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-muted active:bg-muted"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <CategoryIcon
            slug={transaction.category_icon}
            className="size-5 text-muted-foreground"
          />
        </span>
        <p className="min-w-0 flex-1 truncate text-[15px] font-medium">
          {transaction.category_name ?? "기타"}
        </p>
        <span className="text-[15px] font-semibold tabular-nums">
          {formatKRW(Number(transaction.amount))}
        </span>
      </button>

      <TransactionFormDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        initial={initial}
      />
    </>
  );
}
