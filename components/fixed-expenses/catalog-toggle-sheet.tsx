"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { activateCatalogPlanAction } from "@/app/fixed-expenses/actions";
import { BottomSheet, useStableNonNull } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { formatNumber, parseAmountInput } from "@/lib/utils/money";
import { AmountInput } from "./amount-input";
import { SplitChips } from "./split-chips";
import { planLabel, type SubscriptionPlan } from "./types";

type CatalogToggleSheetProps = {
  plan: SubscriptionPlan | null;
  onOpenChange: (open: boolean) => void;
};

export function CatalogToggleSheet({
  plan,
  onOpenChange,
}: CatalogToggleSheetProps) {
  const open = plan !== null;
  // Retain the last non-null plan so the body stays mounted while vaul plays
  // the close animation. Otherwise the body unmounts the moment the parent
  // clears `plan`, the drawer collapses to header height mid-close, and the
  // slide-down looks like an instant cut.
  const displayPlan = useStableNonNull(plan);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={displayPlan ? displayPlan.service_name : "고정지출 추가"}
      subtitle={displayPlan?.plan_name ?? undefined}
      description={`${displayPlan ? planLabel(displayPlan) : "고정지출 추가"} 금액을 확인하고 사용 중인 고정지출로 추가합니다.`}
    >
      {displayPlan ? (
        <CatalogToggleBody
          key={displayPlan.id}
          plan={displayPlan}
          onSaved={() => onOpenChange(false)}
        />
      ) : null}
    </BottomSheet>
  );
}

type BodyProps = {
  plan: SubscriptionPlan;
  onSaved: () => void;
};

function CatalogToggleBody({ plan, onSaved }: BodyProps) {
  const [amountText, setAmountText] = useState(() =>
    formatNumber(plan.default_amount),
  );
  const [pending, startTransition] = useTransition();
  const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
  const canSubmit = amountValue > 0 && !pending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    startTransition(async () => {
      const result = await activateCatalogPlanAction({
        planId: plan.id,
        amount: amountValue,
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
    <form onSubmit={handleSubmit} className="space-y-5 pt-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          {plan.category ? `${plan.category} · ` : ""}매달 결제 금액
        </p>
        <AmountInput value={amountText} onChange={setAmountText} />
        <SplitChips
          baseAmount={plan.default_amount}
          currentValue={amountValue}
          onPick={(next) => setAmountText(formatNumber(next))}
        />
        <p className="text-xs text-muted-foreground">
          기본 금액은 {formatNumber(plan.default_amount)}원이에요. 함께 쓰는
          사람이 있으면 위에서 나눠주세요.
        </p>
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
