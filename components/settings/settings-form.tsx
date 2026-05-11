"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { saveSettingsAction } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber, parseAmountInput } from "@/lib/utils/money";

type SettingsFormProps = {
  initialIncome: number;
  initialFixed: number;
};

export function SettingsForm({
  initialIncome,
  initialFixed,
}: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, null);
  const [income, setIncome] = useState(formatNumber(initialIncome));
  const [fixed, setFixed] = useState(formatNumber(initialFixed));

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("저장됐어요.");
    } else {
      toast.error(state.error);
    }
  }, [state]);

  const incomeNum = parseAmountInput(income);
  const fixedNum = parseAmountInput(fixed);
  const available = Math.max(0, incomeNum - fixedNum);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="monthly_income">월 수입</Label>
        <div className="relative">
          <Input
            id="monthly_income"
            name="monthly_income"
            inputMode="numeric"
            autoComplete="off"
            value={income}
            onChange={(event) =>
              setIncome(formatNumber(parseAmountInput(event.target.value)))
            }
            placeholder="예: 3,000,000"
            className="h-12 rounded-2xl pr-10 text-[16px]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground"
          >
            원
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fixed_expense">월 고정지출</Label>
        <div className="relative">
          <Input
            id="fixed_expense"
            name="fixed_expense"
            inputMode="numeric"
            autoComplete="off"
            value={fixed}
            onChange={(event) =>
              setFixed(formatNumber(parseAmountInput(event.target.value)))
            }
            placeholder="예: 700,000"
            className="h-12 rounded-2xl pr-10 text-[16px]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground"
          >
            원
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          월세, 보험, 통신비 등 매달 빠져나가는 금액
        </p>
      </div>

      <div className="rounded-2xl bg-muted px-4 py-3 text-sm">
        <span className="text-muted-foreground">가용 예산</span>
        <span className="ml-2 font-semibold tabular-nums">
          {formatNumber(available)}원
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
