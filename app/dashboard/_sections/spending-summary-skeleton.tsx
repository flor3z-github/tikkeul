import { Skeleton } from "@/components/ui/skeleton";

export function SpendingSummarySkeleton() {
  return (
    <div className="space-y-4 rounded-3xl border border-black/[0.08] bg-card p-6 dark:border-white/[0.10]">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-44" />
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
