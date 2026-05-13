"use client";

import { useMemo, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deactivateFixedExpenseAction,
  updateFixedExpenseAction,
} from "@/app/fixed-expenses/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatNumber, parseAmountInput } from "@/lib/utils/money";
import { AmountInput } from "./amount-input";
import { SplitChips } from "./split-chips";
import type { FixedExpenseRow, SubscriptionPlan } from "./types";

type ActiveItemSheetProps = {
  item: FixedExpenseRow | null;
  /** Catalog plan reference for this item; null for manual ("직접 추가") items. */
  plan: SubscriptionPlan | null;
  /** Catalog default for split chips; null for manual ("직접 추가") items. */
  catalogDefaultAmount: number | null;
  onOpenChange: (open: boolean) => void;
};

export function ActiveItemSheet({
  item,
  plan,
  catalogDefaultAmount,
  onOpenChange,
}: ActiveItemSheetProps) {
  const open = item !== null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        initialFocus={false}
        className="rounded-t-[28px] border-white/10 bg-background px-5 pb-8 pt-4"
      >
        <SheetHeader className="border-b border-border px-0 pb-4 text-left">
          <SheetTitle className="text-[22px] font-bold tracking-[-0.025em] leading-tight">
            {plan ? plan.service_name : (item?.name ?? "고정지출")}
          </SheetTitle>
          {plan?.plan_name ? (
            <p className="mt-1 text-[13px] font-medium text-muted-foreground leading-tight">
              {plan.plan_name}
            </p>
          ) : null}
          <SheetDescription className="sr-only">
            {item?.name ?? "고정지출"} 금액 수정, 해제, 또는 삭제를 선택합니다.
          </SheetDescription>
        </SheetHeader>

        {item ? (
          <ActiveItemBody
            key={item.id}
            item={item}
            catalogDefaultAmount={catalogDefaultAmount}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

type BodyProps = {
  item: FixedExpenseRow;
  catalogDefaultAmount: number | null;
  onDone: () => void;
};

function ActiveItemBody({ item, catalogDefaultAmount, onDone }: BodyProps) {
  const isCatalog = item.subscription_plan_id !== null;
  const [name, setName] = useState(item.name);
  const [amountText, setAmountText] = useState(formatNumber(item.amount));
  const [savePending, startSaveTransition] = useTransition();
  const [actionPending, startActionTransition] = useTransition();

  const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
  const trimmedName = name.trim();
  const dirty =
    amountValue !== item.amount || (isCatalog ? false : trimmedName !== item.name);
  const canSave =
    amountValue > 0 && trimmedName.length > 0 && dirty && !savePending;

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    startSaveTransition(async () => {
      const result = await updateFixedExpenseAction({
        id: item.id,
        amount: amountValue,
        // Catalog items keep their canonical name from the plan; manual items
        // let the user rename freely.
        ...(isCatalog ? {} : { name: trimmedName }),
      });
      if (result.ok) {
        toast.success("수정됐어요.");
        onDone();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDeactivate() {
    startActionTransition(async () => {
      const result = await deactivateFixedExpenseAction(item.id);
      if (result.ok) {
        toast.success("삭제됐어요.");
        onDone();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {isCatalog ? null : (
        <div className="space-y-2">
          <label
            htmlFor="active-item-name"
            className="block text-sm font-medium text-muted-foreground"
          >
            이름
          </label>
          <input
            id="active-item-name"
            type="text"
            autoComplete="off"
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] outline-none placeholder:text-muted-foreground focus:border-ring"
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted-foreground">
          매달 결제 금액
        </label>
        <AmountInput value={amountText} onChange={setAmountText} />
        {catalogDefaultAmount != null ? (
          <>
            <SplitChips
              baseAmount={catalogDefaultAmount}
              currentValue={amountValue}
              onPick={(next) => setAmountText(formatNumber(next))}
            />
            <p className="text-xs text-muted-foreground">
              기본 금액은 {formatNumber(catalogDefaultAmount)}원이에요. 함께 쓰는
              사람이 있으면 위에서 나눠주세요.
            </p>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Button
          type="submit"
          disabled={!canSave}
          className="col-span-3 h-12 rounded-full text-[15px] font-semibold"
        >
          {savePending ? "수정 중…" : "수정하기"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={handleDeactivate}
          disabled={actionPending}
          aria-label="삭제하기"
          className="col-span-1 h-12 rounded-full px-0 text-[15px] font-semibold"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </form>
  );
}
