import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <AppShell>
      <PageHeader
        eyebrow={
          <Link
            href="/dashboard"
            prefetch
            className="inline-flex items-center gap-1 text-muted-foreground"
          >
            <ChevronLeft className="size-4" />
            대시보드
          </Link>
        }
        title="설정"
      />
      <div className="mt-4 space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </AppShell>
  );
}
