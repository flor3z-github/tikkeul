import { AppShell } from "@/components/layout/app-shell";

export default function Loading() {
  return (
    <AppShell>
      {/* Header skeleton */}
      <div className="mb-6 space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
      </div>

      {/* Summary card skeleton */}
      <div className="space-y-4 rounded-3xl border border-black/[0.08] bg-card p-6 dark:border-white/[0.10]">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-10 w-44 animate-pulse rounded bg-muted" />
        <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </div>

      {/* Recent transactions skeleton */}
      <div className="mt-6 space-y-3">
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="space-y-2 rounded-3xl border border-black/[0.08] bg-card p-3 dark:border-white/[0.10]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2">
              <div className="size-10 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
