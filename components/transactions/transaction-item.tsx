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
  memo: string | null;
};

type TransactionItemProps = {
  transaction: TransactionListRow;
  categories: TransactionFormCategory[];
  /**
   * When true, the item is non-interactive (no edit dialog). Used when viewing
   * a friend's dashboard.
   */
  readOnly?: boolean;
};

const ROW_CLASS =
  "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left";

export function TransactionItem({
  transaction,
  categories,
  readOnly = false,
}: TransactionItemProps) {
  const [open, setOpen] = useState(false);

  const initial: TransactionFormInitial = {
    id: transaction.id,
    amount: Number(transaction.amount),
    category_id: transaction.category_id,
    spent_at: transaction.spent_at,
    memo: transaction.memo,
  };

  const body = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <CategoryIcon
          slug={transaction.category_icon}
          className="size-5 text-muted-foreground"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">
          {transaction.category_name ?? "기타"}
        </p>
        {transaction.memo ? (
          <p className="truncate text-[12px] text-muted-foreground">
            {transaction.memo}
          </p>
        ) : null}
      </div>
      <span className="text-[15px] font-semibold tabular-nums">
        {formatKRW(Number(transaction.amount))}
      </span>
    </>
  );

  if (readOnly) {
    return <div className={ROW_CLASS}>{body}</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${ROW_CLASS} transition-colors hover:bg-muted active:bg-muted`}
      >
        {body}
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
