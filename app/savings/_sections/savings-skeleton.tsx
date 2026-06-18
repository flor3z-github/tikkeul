import { Skeleton } from "@/components/ui/skeleton";

export function SavingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-3xl border border-black/[0.08] bg-card p-6 dark:border-white/[0.10]">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <div className="space-y-2 rounded-3xl border border-black/[0.08] bg-card p-3 dark:border-white/[0.10]">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center justify-between px-2 py-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
