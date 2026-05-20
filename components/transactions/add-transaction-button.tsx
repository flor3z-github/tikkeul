"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  TransactionFormDialog,
  type TransactionFormCategory,
  type TransactionFormGroup,
} from "./transaction-form-dialog";

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
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        aria-label="소비 추가"
        size="icon"
        onClick={() => setOpen(true)}
        className="fixed right-6 z-50 size-14 rounded-full bg-primary text-primary-foreground shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition-transform duration-150 ease-out active:scale-[0.96]"
        style={{
          // Sit above the ~76px BottomTabNav + safe-area inset, with a small gap.
          bottom: "calc(76px + env(safe-area-inset-bottom) + 16px)",
        }}
      >
        <Plus className="size-6" />
      </Button>
      <TransactionFormDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        groups={groups ?? []}
        defaultDate={defaultDate}
      />
    </>
  );
}
