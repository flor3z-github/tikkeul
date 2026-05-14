import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { addMonths } from "@/lib/utils/calendar";

type MonthSwitcherProps = {
  ym: string;
  cycleLabel: string;
};

export function MonthSwitcher({ ym, cycleLabel }: MonthSwitcherProps) {
  const prev = addMonths(ym, -1);
  const next = addMonths(ym, +1);

  return (
    <div className="flex items-center justify-center gap-1 pb-1">
      <Link
        href={`/dashboard?ym=${prev}`}
        prefetch
        aria-label="이전 주기"
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:scale-[0.96]"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <span className="min-w-[7rem] text-center text-[15px] font-semibold tracking-[-0.02em] tabular-nums">
        {cycleLabel}
      </span>
      <Link
        href={`/dashboard?ym=${next}`}
        prefetch
        aria-label="다음 주기"
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:scale-[0.96]"
      >
        <ChevronRight className="size-5" />
      </Link>
    </div>
  );
}
