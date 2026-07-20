"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveIncomeAction } from "@/app/income/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAmountInput, parseAmountInput } from "@/lib/utils/money";

type MonthlyIncomeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIncome: number;
};

export function MonthlyIncomeSheet({
  open,
  onOpenChange,
  initialIncome,
}: MonthlyIncomeSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="월 수입"
      description="매달 들어오는 실수령 금액을 입력해주세요."
    >
      {/* Re-key per open so a canceled edit doesn't leak into the next open. */}
      <MonthlyIncomeForm
        key={open ? "open" : "closed"}
        initialIncome={initialIncome}
        onSaved={() => onOpenChange(false)}
      />
    </BottomSheet>
  );
}

function MonthlyIncomeForm({
  initialIncome,
  onSaved,
}: {
  initialIncome: number;
  onSaved: () => void;
}) {
  const [income, setIncome] = useState(
    initialIncome ? formatAmountInput(String(initialIncome)) : "",
  );
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = parseAmountInput(income);
    startTransition(async () => {
      const result = await saveIncomeAction(parsed);
      if (result.ok) {
        toast.success("월 수입이 저장됐어요.");
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="relative">
        <Input
          inputMode="numeric"
          autoComplete="off"
          aria-label="월 수입"
          value={income}
          onChange={(event) => setIncome(formatAmountInput(event.target.value))}
          placeholder="예: 3,000,000"
          className="h-12 rounded-2xl bg-card pr-10 text-[16px]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground"
        >
          원
        </span>
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-full text-[15px] font-semibold"
      >
        {pending ? "저장 중…" : "저장하기"}
      </Button>
    </form>
  );
}
