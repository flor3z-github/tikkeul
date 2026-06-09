"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { scheduleUndatedFixedAction } from "@/app/dashboard/actions";
import { PaymentDaySelect } from "@/components/fixed-expenses/payment-day-select";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  formatAmountInput,
  formatKRW,
  formatNumber,
  parseAmountInput,
} from "@/lib/utils/money";

const QUICK_AMOUNTS: { value: number; label: string }[] = [
  { value: 1_000, label: "1천" },
  { value: 10_000, label: "1만" },
  { value: 50_000, label: "5만" },
  { value: 100_000, label: "10만" },
];

export type UndatedFixedTarget = {
  fixedExpenseId: string;
  name: string;
  planName: string | null;
  /** Monthly base amount; NULL when the expense itself has "금액 미입력". */
  baseAmount: number | null;
};

type UndatedFixedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** anchorYm "YYYY-MM" of the displayed cycle (override key for the amount). */
  cycleAnchor: string;
  target: UndatedFixedTarget | null;
};

export function UndatedFixedDialog({
  open,
  onOpenChange,
  cycleAnchor,
  target,
}: UndatedFixedDialogProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-white/10 bg-background px-5 pb-8 pt-4">
        <DrawerHeader className="px-0 pb-3 pt-2 text-left">
          <DrawerTitle className="text-[20px] font-bold tracking-[-0.025em]">
            날짜·금액 정하기
          </DrawerTitle>
          <DrawerDescription className="text-[13px] text-muted-foreground">
            날짜를 정하면 달력에 표시돼요. 금액은 이번 달만 적용되고, 다음 달은
            기본 금액으로 돌아가요.
          </DrawerDescription>
        </DrawerHeader>
        {target ? (
          <UndatedFixedBody
            // Reset body state when the target or cycle changes — otherwise
            // opening item A then item B would keep A's date/amount.
            key={`${target.fixedExpenseId}-${cycleAnchor}`}
            cycleAnchor={cycleAnchor}
            target={target}
            onSaved={() => onOpenChange(false)}
          />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function UndatedFixedBody({
  cycleAnchor,
  target,
  onSaved,
}: {
  cycleAnchor: string;
  target: UndatedFixedTarget;
  onSaved: () => void;
}) {
  const [paymentDay, setPaymentDay] = useState<number | null>(null);
  // Start blank: the amount is a per-cycle override ("이번 달만"), so it's only
  // meaningful when this month differs from the base. Prefilling the base would
  // create a redundant override equal to the base and contradict the "비워두고
  // 나중에" hint. The base is shown in the subtitle for reference.
  const [amountText, setAmountText] = useState("");
  const [pending, startTransition] = useTransition();

  const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
  const amountIsEmpty = amountText.trim().length === 0;
  // Date is required (leaving the "날짜 미정" state is the point); amount is
  // optional ("금액 미입력").
  const canSubmit = paymentDay !== null && !pending;

  const inputRef = useRef<HTMLInputElement>(null);

  function focusInput() {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }

  function handleQuickAdd(value: number) {
    setAmountText((prev) => formatNumber(parseAmountInput(prev) + value));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || paymentDay === null) return;
    startTransition(async () => {
      const result = await scheduleUndatedFixedAction({
        fixedExpenseId: target.fixedExpenseId,
        cycleAnchor,
        paymentDay,
        amount: amountIsEmpty ? null : amountValue,
      });
      if (result.ok) {
        toast.success("날짜를 정했어요.");
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-0.5 px-1">
        <p className="truncate text-[15px] font-semibold leading-tight">
          {target.name}
        </p>
        <p className="text-[12px] text-muted-foreground">
          {target.planName
            ? target.planName
            : target.baseAmount != null
              ? `기본 ${formatKRW(target.baseAmount)}`
              : "기본 금액 미입력"}
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="undated-payment-day"
          className="block px-1 text-[13px] font-medium text-muted-foreground"
        >
          결제일
        </label>
        <PaymentDaySelect
          id="undated-payment-day"
          value={paymentDay}
          onChange={setPaymentDay}
        />
      </div>

      <div
        role="presentation"
        onClick={focusInput}
        className="relative cursor-text space-y-4 rounded-2xl bg-muted px-4 pb-4 pt-6"
      >
        {amountValue > 0 ? (
          <div className="absolute right-3 top-3 flex gap-1.5">
            <button
              type="button"
              aria-label="금액 지우기"
              onClick={(event) => {
                event.stopPropagation();
                setAmountText("");
                focusInput();
              }}
              className="flex size-7 items-center justify-center rounded-full bg-card text-muted-foreground transition-all duration-150 ease-out hover:bg-background active:scale-[0.96]"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
        <div className="flex items-baseline justify-center gap-2">
          <input
            ref={inputRef}
            inputMode="numeric"
            aria-label="이번 달 금액"
            value={amountText}
            onChange={(event) =>
              setAmountText(formatAmountInput(event.target.value))
            }
            placeholder="0"
            className="min-w-[1ch] bg-transparent text-right text-[40px] font-bold tracking-[-0.045em] tabular-nums outline-none [field-sizing:content]"
          />
          <span className="text-[22px] font-semibold text-muted-foreground">
            원
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {QUICK_AMOUNTS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleQuickAdd(value);
              }}
              className="h-8 rounded-full bg-card text-xs font-medium tabular-nums shadow-sm transition-all duration-150 ease-out hover:bg-background active:scale-[0.98]"
            >
              +{label}
            </button>
          ))}
        </div>
      </div>
      <p className="px-1 text-[12px] text-muted-foreground">
        금액을 모르면 비워두고 나중에 입력할 수 있어요.
      </p>

      <Button
        type="submit"
        disabled={!canSubmit}
        className="h-12 w-full rounded-full text-[15px] font-semibold"
      >
        {pending ? "저장 중…" : "저장"}
      </Button>
    </form>
  );
}
