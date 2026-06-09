"use client";

import { useMemo, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deactivateFixedExpenseAction,
  updateFixedExpenseAction,
} from "@/app/fixed-expenses/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BottomSheet, useStableNonNull } from "@/components/ui/bottom-sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatNumber, parseAmountInput } from "@/lib/utils/money";
import { AmountInput } from "./amount-input";
import { PaymentDaySelect } from "./payment-day-select";
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
  // Retain item + its plan + its catalog default as ONE atomic snapshot so the
  // body stays mounted while vaul plays the close animation. Retaining the
  // three as INDEPENDENT useStableNonNull values is a bug: opening a catalog
  // item (plan non-null) then a manual item (plan null) would keep the catalog
  // item's plan — the manual item's null plan/null default fall back to the
  // retained catalog values, so the header shows the previous service's name
  // and the split chips its price. Bundling ties plan/catalogDefaultAmount to
  // the currently-open item; a manual item correctly clears them. useMemo keeps
  // the object reference stable (an inline literal would trip useStableNonNull's
  // identity check every render and loop).
  const snapshot = useMemo(
    () => (item ? { item, plan, catalogDefaultAmount } : null),
    [item, plan, catalogDefaultAmount],
  );
  const stable = useStableNonNull(snapshot);
  const displayItem = stable?.item ?? null;
  const displayPlan = stable?.plan ?? null;
  const displayCatalogDefaultAmount = stable?.catalogDefaultAmount ?? null;

  const title = displayPlan
    ? displayPlan.service_name
    : (displayItem?.name ?? "고정지출");
  const subtitle = displayPlan?.plan_name ?? displayItem?.plan_name ?? undefined;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      description={`${displayItem?.name ?? "고정지출"} 금액 수정, 해제, 또는 삭제를 선택합니다.`}
    >
      {displayItem ? (
        <ActiveItemBody
          key={displayItem.id}
          item={displayItem}
          catalogDefaultAmount={displayCatalogDefaultAmount}
          onDone={() => onOpenChange(false)}
        />
      ) : null}
    </BottomSheet>
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
  const [planName, setPlanName] = useState(item.plan_name ?? "");
  const [amountText, setAmountText] = useState(
    item.amount != null ? formatNumber(item.amount) : "",
  );
  const [paymentDay, setPaymentDay] = useState<number | null>(item.payment_day);
  const [savePending, startSaveTransition] = useTransition();
  const [actionPending, startActionTransition] = useTransition();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
  // Amount is optional ("금액 미입력"): empty input stores null.
  const amountIsEmpty = amountText.trim().length === 0;
  const nextAmount = amountIsEmpty ? null : amountValue;
  const trimmedName = name.trim();
  const trimmedPlanName = planName.trim();
  const planNameChanged =
    !isCatalog && trimmedPlanName !== (item.plan_name ?? "");
  const paymentDayChanged = paymentDay !== item.payment_day;
  const dirty =
    nextAmount !== item.amount ||
    (isCatalog ? false : trimmedName !== item.name) ||
    planNameChanged ||
    paymentDayChanged;
  const canSave = trimmedName.length > 0 && dirty && !savePending;

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    startSaveTransition(async () => {
      const result = await updateFixedExpenseAction({
        id: item.id,
        amount: nextAmount,
        // Catalog items keep their canonical name from the plan; manual items
        // let the user rename freely.
        ...(isCatalog
          ? {}
          : {
              name: trimmedName,
              plan_name: trimmedPlanName.length > 0 ? trimmedPlanName : null,
            }),
        ...(paymentDayChanged ? { payment_day: paymentDay } : {}),
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
    setConfirmDeleteOpen(false);
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
    <form onSubmit={handleSave} className="space-y-5 pt-4">
      {isCatalog ? null : (
        <>
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
          <div className="space-y-2">
            <label
              htmlFor="active-item-plan-name"
              className="block text-sm font-medium text-muted-foreground"
            >
              플랜 <span className="text-muted-foreground/70">(선택)</span>
            </label>
            <input
              id="active-item-plan-name"
              type="text"
              autoComplete="off"
              maxLength={40}
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
              placeholder="예: 프리미엄, 200GB, 가족"
              className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] outline-none placeholder:text-muted-foreground focus:border-ring"
            />
          </div>
        </>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted-foreground">
          매달 결제 금액 <span className="text-muted-foreground/70">(선택)</span>
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

      <div className="space-y-2">
        <label
          htmlFor="active-item-payment-day"
          className="block text-sm font-medium text-muted-foreground"
        >
          결제일 <span className="text-muted-foreground/70">(선택)</span>
        </label>
        <PaymentDaySelect
          id="active-item-payment-day"
          value={paymentDay}
          onChange={setPaymentDay}
        />
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
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={actionPending}
          aria-label="삭제하기"
          className="col-span-1 h-12 rounded-full px-0 text-[15px] font-semibold"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          if (!actionPending) setConfirmDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 고정지출을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              가용 예산 계산에서도 즉시 빠져요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDeactivate();
              }}
              disabled={actionPending}
              className={buttonVariants({ variant: "destructive" })}
            >
              {actionPending ? "삭제 중…" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
