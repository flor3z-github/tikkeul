import Link from "next/link";
import { Suspense } from "react";
import { Settings } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SpendingSummarySection } from "./_sections/spending-summary-section";
import { SpendingSummarySkeleton } from "./_sections/spending-summary-skeleton";
import { RecentTransactionsSection } from "./_sections/recent-transactions-section";
import { RecentTransactionsSkeleton } from "./_sections/recent-transactions-skeleton";

// Kept until Next 16 PPR is stable enough to enable. To migrate:
//   1) remove this line
//   2) add: export const experimental_ppr = true
//   3) set experimental.ppr = "incremental" in next.config.ts
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <AppShell withBottomNav>
      <PageHeader
        eyebrow="이번 달 소비를 가볍게 확인해요"
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
        <SpendingSummarySection />
      </Suspense>

      <Suspense fallback={<RecentTransactionsSkeleton />}>
        <RecentTransactionsSection />
      </Suspense>
    </AppShell>
  );
}
