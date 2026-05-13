import Link from "next/link";
import { Suspense } from "react";
import { Settings } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatYearMonthKorean,
  resolveDashboardParams,
} from "@/lib/utils/calendar";
import { SpendingSummarySection } from "./_sections/spending-summary-section";
import { SpendingSummarySkeleton } from "./_sections/spending-summary-skeleton";
import { SpendingCalendarSection } from "./_sections/spending-calendar-section";
import { SpendingCalendarSkeleton } from "./_sections/spending-calendar-skeleton";
import { DayTransactionsSection } from "./_sections/day-transactions-section";
import { DayTransactionsSkeleton } from "./_sections/day-transactions-skeleton";

// Kept until Next 16 PPR is stable enough to enable. To migrate:
//   1) remove this line
//   2) add: export const experimental_ppr = true
//   3) set experimental.ppr = "incremental" in next.config.ts
export const dynamic = "force-dynamic";

type DashboardSearchParams = Promise<{
  ym?: string;
  day?: string;
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const sp = await searchParams;
  const { ym, day } = resolveDashboardParams(sp);
  const monthLabel = formatYearMonthKorean(ym);

  return (
    <AppShell withBottomNav withFab>
      <PageHeader
        eyebrow={`${monthLabel} 소비를 확인해요`}
        title="티끌"
        trailing={
          <Link
            href="/settings"
            prefetch
            aria-label="설정"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "rounded-full text-muted-foreground",
            )}
          >
            <Settings className="size-5" />
          </Link>
        }
      />

      <Suspense fallback={<SpendingSummarySkeleton />}>
        <SpendingSummarySection ym={ym} />
      </Suspense>

      <Suspense fallback={<SpendingCalendarSkeleton />}>
        <SpendingCalendarSection ym={ym} day={day} />
      </Suspense>

      <Suspense fallback={<DayTransactionsSkeleton />}>
        <DayTransactionsSection ym={ym} day={day} />
      </Suspense>
    </AppShell>
  );
}
