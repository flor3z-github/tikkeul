"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { addManualFixedExpenseAction } from "@/app/fixed-expenses/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { parseAmountInput } from "@/lib/utils/money";
import { AmountInput } from "./amount-input";
import { PaymentDaySelect } from "./payment-day-select";

type ManualAddSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ManualAddSheet({ open, onOpenChange }: ManualAddSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="직접 추가"
      description="카탈로그에 없는 고정지출 항목을 직접 입력합니다."
    >
      {/* Body renders unconditionally so the drawer keeps its full height
          during vaul's close animation. Radix Presence unmounts the whole
          DrawerContent (and this body with it) after the animation ends,
          so each reopen gets a freshly mounted body with empty state. */}
      <ManualAddBody onSaved={() => onOpenChange(false)} />
    </BottomSheet>
  );
}

function ManualAddBody({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [planName, setPlanName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [paymentDay, setPaymentDay] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
  const trimmedName = name.trim();
  const trimmedPlanName = planName.trim();
  // Amount is optional ("금액 미입력") — only the name is required. Empty input
  // is stored as null so it can be filled in later.
  const amountIsEmpty = amountText.trim().length === 0;
  const canSubmit = trimmedName.length > 0 && !pending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await addManualFixedExpenseAction({
        name: trimmedName,
        plan_name: trimmedPlanName.length > 0 ? trimmedPlanName : null,
        amount: amountIsEmpty ? null : amountValue,
        payment_day: paymentDay,
      });
      if (result.ok) {
        toast.success("추가됐어요.");
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="manual-name"
          className="block text-sm font-medium text-muted-foreground"
        >
          이름
        </label>
        <input
          id="manual-name"
          type="text"
          autoComplete="off"
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="예: 월세, 인터넷, 보험"
          className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] outline-none placeholder:text-muted-foreground focus:border-ring"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="manual-plan-name"
          className="block text-sm font-medium text-muted-foreground"
        >
          플랜 <span className="text-muted-foreground/70">(선택)</span>
        </label>
        <input
          id="manual-plan-name"
          type="text"
          autoComplete="off"
          maxLength={40}
          value={planName}
          onChange={(event) => setPlanName(event.target.value)}
          placeholder="예: 프리미엄, 200GB, 가족"
          className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] outline-none placeholder:text-muted-foreground focus:border-ring"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted-foreground">
          매달 결제 금액 <span className="text-muted-foreground/70">(선택)</span>
        </label>
        <AmountInput value={amountText} onChange={setAmountText} />
        <p className="px-1 text-[12px] text-muted-foreground">
          금액을 모르면 비워두고 나중에 입력할 수 있어요.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="manual-payment-day"
          className="block text-sm font-medium text-muted-foreground"
        >
          결제일 <span className="text-muted-foreground/70">(선택)</span>
        </label>
        <PaymentDaySelect
          id="manual-payment-day"
          value={paymentDay}
          onChange={setPaymentDay}
        />
      </div>

      <Button
        type="submit"
        disabled={!canSubmit}
        className="h-12 w-full rounded-full text-[15px] font-semibold"
      >
        {pending ? "추가 중…" : "추가하기"}
      </Button>
    </form>
  );
}
