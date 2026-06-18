import Link from "next/link";
import { Settings } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SavingsSkeleton } from "./_sections/savings-skeleton";

export default function SavingsLoading() {
  return (
    <AppShell withBottomNav withFab>
      <PageHeader
        eyebrow="매달 차곡차곡 모이는 돈"
        title="돈모으기"
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
      <SavingsSkeleton />
    </AppShell>
  );
}
