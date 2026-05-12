"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  TransactionFormDialog,
  type TransactionFormCategory,
} from "./transaction-form-dialog";

type AddTransactionButtonProps = {
  categories: TransactionFormCategory[];
};

export function AddTransactionButton({ categories }: AddTransactionButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        aria-label="소비 추가"
        size="icon"
        onClick={() => setOpen(true)}
        className="fixed right-6 z-50 size-14 rounded-full bg-primary text-primary-foreground shadow-[0_12px_40px_rgba(0,0,0,0.18)] active:scale-[0.96]"
        style={{
          // Sit above the 56px BottomTabNav + safe-area inset, with a small gap.
          bottom: "calc(56px + env(safe-area-inset-bottom) + 16px)",
        }}
      >
        <Plus className="size-6" />
      </Button>
      <TransactionFormDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
      />
    </>
  );
}
