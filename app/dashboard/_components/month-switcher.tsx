"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { useLinkPendingStatus } from "@/components/layout/nav-progress";
import { addMonths } from "@/lib/utils/calendar";

type MonthSwitcherProps = {
  ym: string;
  cycleLabel: string;
};

export function MonthSwitcher({ ym, cycleLabel }: MonthSwitcherProps) {
  const prev = addMonths(ym, -1);
  const next = addMonths(ym, +1);
  const searchParams = useSearchParams();
  const viewing = searchParams?.get("viewing");

  const buildHref = (targetYm: string) => {
    const params = new URLSearchParams();
    params.set("ym", targetYm);
    if (viewing) params.set("viewing", viewing);
    return `/dashboard?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-center gap-1 pb-1">
      <Link
        href={buildHref(prev)}
        prefetch
        aria-label="이전 주기"
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-all duration-150 ease-out hover:bg-muted active:scale-[0.96]"
      >
        <MonthChevron direction="left" />
      </Link>
      <span className="min-w-[7rem] text-center text-[15px] font-semibold tracking-[-0.02em] tabular-nums">
        {cycleLabel}
      </span>
      <Link
        href={buildHref(next)}
        prefetch
        aria-label="다음 주기"
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-all duration-150 ease-out hover:bg-muted active:scale-[0.96]"
      >
        <MonthChevron direction="right" />
      </Link>
    </div>
  );
}

/**
 * Direct child of the surrounding <Link> so useLinkStatus picks up this
 * link's pending state. Swaps the chevron for a spinner while the route
 * transition is in flight — the user gets immediate feedback that their
 * tap was registered, instead of a dead-feeling button.
 */
function MonthChevron({ direction }: { direction: "left" | "right" }) {
  const pending = useLinkPendingStatus();
  if (pending) {
    return <Loader2 className="size-4 animate-spin" />;
  }
  return direction === "left" ? (
    <ChevronLeft className="size-5" />
  ) : (
    <ChevronRight className="size-5" />
  );
}
