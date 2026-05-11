import type { SpendingStatus } from "@/lib/utils/budget";

type SpendingProgressProps = {
  rate: number;
  status: SpendingStatus;
};

const STATUS_BAR_COLOR: Record<SpendingStatus, string> = {
  normal: "bg-primary",
  caution: "bg-[color:var(--warning)]",
  warning: "bg-[color:var(--warning)]",
  over: "bg-destructive",
};

export function SpendingProgress({ rate, status }: SpendingProgressProps) {
  const clamped = Math.max(0, Math.min(100, rate));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ${STATUS_BAR_COLOR[status]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
