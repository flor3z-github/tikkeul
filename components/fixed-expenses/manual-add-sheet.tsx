"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { addManualFixedExpenseAction } from "@/app/fixed-expenses/actions";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { parseAmountInput } from "@/lib/utils/money";
import { AmountInput } from "./amount-input";

type ManualAddSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ManualAddSheet({ open, onOpenChange }: ManualAddSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-white/10 bg-background px-5 pb-8 pt-2">
        <DrawerHeader className="px-0 pb-3 pt-2 text-left">
          <DrawerTitle className="text-[22px] font-bold tracking-[-0.025em]">
            직접 추가
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            카탈로그에 없는 고정지출 항목을 직접 입력합니다.
          </DrawerDescription>
        </DrawerHeader>

        {/* Body renders unconditionally so the drawer keeps its full height
            during vaul's close animation. Radix Presence unmounts the whole
            DrawerContent (and this body with it) after the animation ends,
            so each reopen gets a freshly mounted body with empty state. */}
        <ManualAddBody onSaved={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}

function ManualAddBody({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [planName, setPlanName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [pending, startTransition] = useTransition();
  const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
  const trimmedName = name.trim();
  const trimmedPlanName = planName.trim();
  const canSubmit = trimmedName.length > 0 && amountValue > 0 && !pending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await addManualFixedExpenseAction({
        name: trimmedName,
        plan_name: trimmedPlanName.length > 0 ? trimmedPlanName : null,
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
          매달 결제 금액
        </label>
        <AmountInput value={amountText} onChange={setAmountText} />
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
