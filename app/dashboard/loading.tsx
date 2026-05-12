import Link from "next/link";
import { Settings } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SpendingSummarySkeleton } from "./_sections/spending-summary-skeleton";
import { SpendingCalendarSkeleton } from "./_sections/spending-calendar-skeleton";
import { DayTransactionsSkeleton } from "./_sections/day-transactions-skeleton";

export default function DashboardLoading() {
  return (
    <AppShell withBottomNav>
      <PageHeader
        eyebrow="이번 달 소비를 확인해요"
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
      <div className="mt-12 h-9" aria-hidden />
      <div className="mt-4">
        <SpendingSummarySkeleton />
      </div>
      <SpendingCalendarSkeleton />
      <DayTransactionsSkeleton />
    </AppShell>
  );
}
