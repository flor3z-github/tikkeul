import Link from "next/link";
import { Suspense } from "react";
import { Settings } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FixedExpensesSection } from "./_sections/fixed-expenses-section";
import { FixedExpensesSkeleton } from "./_sections/fixed-expenses-skeleton";

export default function FixedExpensesPage() {
  return (
    <AppShell withBottomNav>
      <PageHeader
        eyebrow="매달 자동으로 빠지는 돈"
        title="고정지출"
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

      <Suspense fallback={<FixedExpensesSkeleton />}>
        <FixedExpensesSection />
      </Suspense>
    </AppShell>
  );
}
