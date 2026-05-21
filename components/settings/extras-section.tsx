"use client";

import { useState } from "react";
import { Hand, Plus } from "lucide-react";
import { toast } from "sonner";

import { IncomeFormDialog } from "@/components/income/income-form-dialog";
import { LONG_PRESS_GUIDE_FLAG } from "@/components/onboarding/long-press-guide";
import { Button } from "@/components/ui/button";

type SettingsExtrasProps = {
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

export function SettingsExtras({
  cycleStart,
  cycleEnd,
  defaultDate,
}: SettingsExtrasProps) {
  const [open, setOpen] = useState(false);

  function resetGuide() {
    try {
      window.localStorage.removeItem(LONG_PRESS_GUIDE_FLAG);
      toast.success("다음 대시보드 방문에서 안내가 다시 나와요.");
    } catch {
      toast.error("기기에서 안내를 다시 표시할 수 없어요.");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="px-1 text-[15px] font-semibold tracking-[-0.01em]">
        기능
      </h2>
      <div className="space-y-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen(true)}
          className="h-12 w-full justify-start rounded-2xl text-[14px]"
        >
          <Plus className="mr-2 size-4" aria-hidden />
          추가 수입 등록
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={resetGuide}
          className="h-12 w-full justify-start rounded-2xl text-[14px] text-muted-foreground"
        >
          <Hand className="mr-2 size-4" aria-hidden />
          기능 안내 다시 보기
        </Button>
      </div>

      <IncomeFormDialog
        open={open}
        onOpenChange={setOpen}
        cycleStart={parseYmd(cycleStart)}
        cycleEnd={parseYmd(cycleEnd)}
        defaultDate={defaultDate}
      />
    </section>
  );
}
