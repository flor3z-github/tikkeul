import { Skeleton } from "@/components/ui/skeleton";

export function SpendingCalendarSkeleton() {
  return (
    <div className="mt-3 space-y-1.5 rounded-3xl border border-black/[0.08] bg-card p-3 dark:border-white/[0.10]">
      <div className="flex items-center justify-center gap-1 pb-1">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="size-8 rounded-full" />
      </div>
      <div className="grid grid-cols-7 gap-0.5 px-0.5 pb-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="mx-auto h-3 w-4" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: 42 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
