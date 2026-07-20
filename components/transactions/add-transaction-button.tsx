"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import {
  TransactionFormDialog,
  type TransactionFormCategory,
  type TransactionFormGroup,
} from "@/components/transactions/transaction-form-dialog";

type AddTransactionButtonProps = {
  categories: TransactionFormCategory[];
  /** Owner's friend groups (seed + user-defined), forwarded to the form so
   *  the visibility selector can render. Empty until the data loads. */
  groups?: TransactionFormGroup[];
  /** YYYY-MM-DD. Pre-fills the date field when opening in create mode. */
  defaultDate?: string;
};

export function AddTransactionButton({
  categories,
  groups,
  defaultDate,
}: AddTransactionButtonProps) {
  const [transactionOpen, setTransactionOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        data-fab="add-transaction"
        aria-label="소비 추가"
        onClick={() => setTransactionOpen(true)}
        style={{
          right: 24,
          bottom: "calc(76px + env(safe-area-inset-bottom) + 16px)",
          touchAction: "manipulation",
        }}
        className="fixed z-50 flex size-14 items-center justify-center rounded-[28px] bg-primary text-primary-foreground shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition-transform duration-150 ease-out active:scale-95"
      >
        <Plus className="size-6" />
      </button>

      <TransactionFormDialog
        open={transactionOpen}
        onOpenChange={setTransactionOpen}
        categories={categories}
        groups={groups ?? []}
        defaultDate={defaultDate}
      />
    </>
  );
}
