import { Skeleton } from "@/components/ui/skeleton";

export function FixedExpensesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-3xl border border-black/[0.08] bg-card p-6 dark:border-white/[0.10]">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-3 w-2/3" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <div className="space-y-2 rounded-3xl border border-black/[0.08] bg-card p-3 dark:border-white/[0.10]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
