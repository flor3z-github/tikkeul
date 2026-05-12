import Link from "next/link";
import { Settings } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FixedExpensesSkeleton } from "./_sections/fixed-expenses-skeleton";

export default function FixedExpensesLoading() {
  return (
    <AppShell withBottomNav>
      <PageHeader
        eyebrow="매달 빠지는 돈"
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
      <FixedExpensesSkeleton />
    </AppShell>
  );
}
