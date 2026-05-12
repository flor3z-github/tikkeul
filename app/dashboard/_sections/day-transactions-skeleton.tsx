import { Skeleton } from "@/components/ui/skeleton";

export function DayTransactionsSkeleton() {
  return (
    <section className="mt-6 space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-2 rounded-3xl border border-black/[0.08] bg-card p-2 dark:border-white/[0.10]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </section>
  );
}
