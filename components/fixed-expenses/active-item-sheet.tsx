"use client";

import { useMemo, useState, useTransition } from "react";
import { CircleSlash, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deactivateFixedExpenseAction,
  deleteFixedExpenseAction,
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
import type { FixedExpenseRow } from "./types";

type ActiveItemSheetProps = {
  item: FixedExpenseRow | null;
  /** Catalog default for split chips; null for manual ("직접 추가") items. */
  catalogDefaultAmount: number | null;
  onOpenChange: (open: boolean) => void;
};

export function ActiveItemSheet({
  item,
  catalogDefaultAmount,
  onOpenChange,
}: ActiveItemSheetProps) {
  const open = item !== null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[28px] border-white/10 bg-background px-5 pb-8 pt-4"
      >
        <SheetHeader className="px-0 pb-3 text-left">
          <SheetTitle className="text-[22px] font-bold tracking-[-0.025em]">
            {item?.name ?? "고정지출"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            금액 수정, 해제, 또는 삭제를 선택합니다.
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
        toast.success("해제됐어요.");
        onDone();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    startActionTransition(async () => {
      const result = await deleteFixedExpenseAction(item.id);
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
          <SplitChips
            baseAmount={catalogDefaultAmount}
            currentValue={amountValue}
            onPick={(next) => setAmountText(formatNumber(next))}
          />
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={!canSave}
        className="h-12 w-full rounded-full text-[15px] font-semibold"
      >
        {savePending ? "저장 중…" : "저장하기"}
      </Button>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          onClick={handleDeactivate}
          disabled={actionPending}
          className="h-11 rounded-full text-[14px] text-muted-foreground hover:bg-muted"
        >
          <CircleSlash className="mr-1 size-4" />
          해제
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handleDelete}
          disabled={actionPending}
          className="h-11 rounded-full text-[14px] text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="mr-1 size-4" />
          삭제
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        해제하면 가용 예산에서 빠지고 카탈로그에서 다시 켤 수 있어요. 삭제는
        기록까지 지워요.
      </p>
    </form>
  );
}
