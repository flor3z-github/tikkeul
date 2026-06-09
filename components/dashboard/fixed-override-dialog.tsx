"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import {
  deleteFixedOverrideAction,
  upsertFixedOverrideAction,
} from "@/app/dashboard/actions";
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

export type FixedOverrideTarget = {
  fixedExpenseId: string;
  name: string;
  planName: string | null;
  /** Monthly base amount; NULL when the expense itself has "금액 미입력". */
  baseAmount: number | null;
  /** Current effective amount for this cycle (override ?? base); NULL = 미입력. */
  currentAmount: number | null;
  /** True when an override row already exists for this cycle. */
  isOverridden: boolean;
};

type FixedOverrideDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** anchorYm "YYYY-MM" of the displayed cycle. */
  cycleAnchor: string;
  target: FixedOverrideTarget | null;
};

export function FixedOverrideDialog({
  open,
  onOpenChange,
  cycleAnchor,
  target,
}: FixedOverrideDialogProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-white/10 bg-background px-5 pb-8 pt-4">
        <DrawerHeader className="px-0 pb-3 pt-2 text-left">
          <DrawerTitle className="text-[20px] font-bold tracking-[-0.025em]">
            이번 달 금액
          </DrawerTitle>
          <DrawerDescription className="text-[13px] text-muted-foreground">
            이번 달에 실제로 빠진 금액으로 바꿔요. 다음 달은 기본 금액으로
            돌아가요.
          </DrawerDescription>
        </DrawerHeader>
        {target ? (
          <FixedOverrideBody
            // Reset body state when the target or cycle changes.
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

function FixedOverrideBody({
  cycleAnchor,
  target,
  onSaved,
}: {
  cycleAnchor: string;
  target: FixedOverrideTarget;
  onSaved: () => void;
}) {
  const [amountText, setAmountText] = useState(() =>
    target.currentAmount != null ? formatNumber(target.currentAmount) : "",
  );
  const [pending, startTransition] = useTransition();
  const [revertPending, setRevertPending] = useState(false);
  const busy = pending || revertPending;

  const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
  const hasValue = amountText.trim().length > 0;
  const canSubmit = hasValue && !busy;

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
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await upsertFixedOverrideAction({
        fixedExpenseId: target.fixedExpenseId,
        cycleAnchor,
        amount: amountValue,
      });
      if (result.ok) {
        toast.success("이번 달 금액을 적용했어요.");
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRevert() {
    setRevertPending(true);
    void (async () => {
      const result = await deleteFixedOverrideAction({
        fixedExpenseId: target.fixedExpenseId,
        cycleAnchor,
      });
      setRevertPending(false);
      if (result.ok) {
        toast.success("기본 금액으로 되돌렸어요.");
        onSaved();
      } else {
        toast.error(result.error);
      }
    })();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-0.5 px-1">
        <p className="truncate text-[15px] font-semibold leading-tight">
          {target.name}
        </p>
        <p className="text-[12px] text-muted-foreground">
          {target.baseAmount != null
            ? `기본 ${formatKRW(target.baseAmount)}`
            : "기본 금액 미입력"}
        </p>
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

      <Button
        type="submit"
        disabled={!canSubmit}
        className="h-12 w-full rounded-full text-[15px] font-semibold"
      >
        {pending ? "적용 중…" : "이번 달 금액 적용"}
      </Button>

      {target.isOverridden ? (
        <Button
          type="button"
          variant="ghost"
          onClick={handleRevert}
          disabled={busy}
          className="h-11 w-full rounded-full text-[14px] font-medium text-muted-foreground"
        >
          {revertPending ? "되돌리는 중…" : "기본 금액으로 되돌리기"}
        </Button>
      ) : null}
    </form>
  );
}
