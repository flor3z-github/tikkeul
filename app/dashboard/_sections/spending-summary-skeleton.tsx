import { Skeleton } from "@/components/ui/skeleton";

export function SpendingSummarySkeleton() {
  return (
    <div className="space-y-4 rounded-3xl border border-black/[0.08] bg-card px-6 py-4 dark:border-white/[0.10]">
      <div className="grid grid-cols-2 items-end gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="flex items-center justify-between border-t border-dashed border-border pt-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-36" />
      </div>
    </div>
  );
}
