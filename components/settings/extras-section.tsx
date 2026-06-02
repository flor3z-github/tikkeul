"use client";

import { useState } from "react";
import { Hand, Plus } from "lucide-react";
import { toast } from "sonner";

import { IncomeFormDialog } from "@/components/income/income-form-dialog";
import { LONG_PRESS_GUIDE_FLAG } from "@/components/onboarding/long-press-guide";
import { Button } from "@/components/ui/button";

type AddIncomeButtonProps = {
  /** YYYY-MM-DD. Inclusive start of the viewer's *current* cycle, used to
   *  bound the income drawer's calendar picker. */
  cycleStart: string;
  /** YYYY-MM-DD. Exclusive end of the viewer's current cycle. */
  cycleEnd: string;
  /** YYYY-MM-DD. Pre-fills the income drawer's date field; pre-clamped on
   *  the server so the user lands on a valid date. */
  defaultDate: string;
};

// Parse YYYY-MM-DD to a local-midnight Date. `new Date(string)` would
// interpret an ISO date as UTC midnight and drift by the user's tz offset.
function parseYmd(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function AddIncomeButton({
  cycleStart,
  cycleEnd,
  defaultDate,
}: AddIncomeButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        className="h-12 w-full justify-start rounded-2xl text-[14px]"
      >
        <Plus className="mr-2 size-4" aria-hidden />
        추가 수입 등록
      </Button>

      <IncomeFormDialog
        open={open}
        onOpenChange={setOpen}
        cycleStart={parseYmd(cycleStart)}
        cycleEnd={parseYmd(cycleEnd)}
        defaultDate={defaultDate}
      />
    </>
  );
}

export function GuideResetButton() {
  function resetGuide() {
    try {
      window.localStorage.removeItem(LONG_PRESS_GUIDE_FLAG);
      toast.success("다음 대시보드 방문에서 안내가 다시 나와요.");
    } catch {
      toast.error("기기에서 안내를 다시 표시할 수 없어요.");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={resetGuide}
      className="h-12 w-full justify-start rounded-2xl text-[14px] text-muted-foreground"
    >
      <Hand className="mr-2 size-4" aria-hidden />
      기능 안내 다시 보기
    </Button>
  );
}
