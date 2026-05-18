"use client";

import { useState } from "react";

import {
  TransactionInteractionSheet,
  type InteractionTransaction,
} from "@/components/dashboard/transaction-interaction-sheet";
import {
  TransactionFormDialog,
  type TransactionFormCategory,
  type TransactionFormInitial,
} from "@/components/transactions/transaction-form-dialog";
import { CategoryIcon } from "@/lib/utils/category-icon";
import { formatKRW } from "@/lib/utils/money";

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
  /** True when the transaction belongs to the viewer (own dashboard). When
   *  true, clicking the row opens the edit form directly; the friend-mode
   *  interaction sheet is skipped entirely. */
  isOwn: boolean;
  /** Transaction owner's user_id. Used by the sheet's [답장] button to route
   *  the viewer to the right DM thread in friend mode. */
  ownerUserId: string;
};

const ROW_CLASS =
  "block w-full rounded-2xl px-3 py-2 text-left motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200";

export function TransactionItem({
  transaction,
  categories,
  isOwn,
  ownerUserId,
}: TransactionItemProps) {
  const [open, setOpen] = useState(false);

  const interactionTransaction: InteractionTransaction = {
    id: transaction.id,
    amount: Number(transaction.amount),
    category_id: transaction.category_id,
    category_name: transaction.category_name,
    category_icon: transaction.category_icon,
    spent_at: transaction.spent_at,
    memo: transaction.memo,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${ROW_CLASS} transition-colors hover:bg-muted active:bg-muted`}
      >
        <div className="flex w-full items-center gap-3">
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
        </div>
      </button>

      {isOwn ? (
        <TransactionFormDialog
          open={open}
          onOpenChange={setOpen}
          categories={categories}
          initial={toFormInitial(interactionTransaction)}
          onSaved={() => setOpen(false)}
        />
      ) : (
        <TransactionInteractionSheet
          open={open}
          onOpenChange={setOpen}
          transaction={interactionTransaction}
          ownerUserId={ownerUserId}
        />
      )}
    </>
  );
}

function toFormInitial(tx: InteractionTransaction): TransactionFormInitial {
  return {
    id: tx.id,
    amount: tx.amount,
    category_id: tx.category_id,
    spent_at: tx.spent_at,
    memo: tx.memo,
  };
}
