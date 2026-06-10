import { CategoryIcon } from "@/lib/utils/category-icon";
import { FixedCategoryBadge } from "@/lib/utils/fixed-category-icon";
import { cn } from "@/lib/utils";
import { formatKRW, formatNumber } from "@/lib/utils/money";
import type {
  FixedBreakdownRow,
  VariableBreakdownRow,
} from "@/lib/utils/stats/cycle-breakdown";

type CycleBreakdownViewProps = {
  cycleLabel: string;
  grandTotal: number;
  variableTotal: number;
  fixedTotal: number;
  /** 총 소비 change vs the previous cycle. null = no comparable prior cycle. */
  topDelta: number | null;
  variableRows: VariableBreakdownRow[];
  fixedRows: FixedBreakdownRow[];
};

const NEUTRAL_SWATCH = "#8E8E93";

/**
 * /stats 본문 — "이번 사이클에 돈이 어디로 갔나"를 변동(카테고리 집계, CSS 막대)과
 * 고정(카탈로그 그룹, 항목별)으로 분해한다 (§12.9). 차트 없이 분해 리스트만, surface
 * 1단계. 상단 총액·변동 카테고리별·고정 항목별에 직전 사이클 대비 ±delta를 단다.
 */
export function CycleBreakdownView({
  cycleLabel,
  grandTotal,
  variableTotal,
  fixedTotal,
  topDelta,
  variableRows,
  fixedRows,
}: CycleBreakdownViewProps) {
  const isEmpty =
    grandTotal === 0 && variableRows.length === 0 && fixedRows.length === 0;
  const showTopDelta = topDelta != null && topDelta !== 0;

  return (
    <div className="space-y-6">
      {/* 상단 총 소비 — 대시보드 '쓴 돈'과 정확히 같은 값. */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">
          {cycleLabel} 총 소비
        </p>
        <p
          key={cycleLabel}
          className="text-[40px] font-bold leading-none tracking-[-0.045em] tabular-nums animate-in fade-in duration-200"
        >
          {formatNumber(grandTotal)}
          <span className="ml-1 text-xl font-semibold text-muted-foreground">
            원
          </span>
        </p>
        {!isEmpty ? (
          <p className="text-[13px] text-muted-foreground">
            변동 {formatKRW(variableTotal)} · 고정 {formatKRW(fixedTotal)}
          </p>
        ) : null}
        {showTopDelta ? (
          <p
            className={cn(
              "text-[13px] tabular-nums",
              topDelta! > 0
                ? "text-[color:var(--warning)]"
                : "text-muted-foreground",
            )}
          >
            지난 사이클보다 {topDelta! > 0 ? "↑" : "↓"}{" "}
            {topDelta! > 0 ? "+" : "−"}
            {formatNumber(Math.abs(topDelta!))}원
          </p>
        ) : null}
      </div>

      {isEmpty ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
          이번 사이클엔 아직 기록이 없어요.
        </p>
      ) : null}

      {variableRows.length > 0 ? (
        <section className="space-y-1">
          <SectionHeading title="변동 소비" total={variableTotal} />
          <ul>
            {variableRows.map((row) => (
              <VariableRow key={row.categoryId ?? "__uncat__"} row={row} />
            ))}
          </ul>
        </section>
      ) : null}

      {variableRows.length > 0 && fixedRows.length > 0 ? (
        <hr aria-hidden className="border-border" />
      ) : null}

      {fixedRows.length > 0 ? (
        <section className="space-y-1">
          <SectionHeading title="고정 소비" total={fixedTotal} />
          <ul>
            {fixedRows.map((row) => (
              <FixedRow key={row.id} row={row} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SectionHeading({ title, total }: { title: string; total: number }) {
  return (
    <div className="flex items-baseline justify-between px-1 pb-1">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
      <span className="text-[13px] tabular-nums text-muted-foreground">
        {formatKRW(total)}
      </span>
    </div>
  );
}

/** 직전 사이클 대비 ±N. up(더 씀)=warning, down(덜 씀)=muted. */
function DeltaBadge({ delta }: { delta: number }) {
  const up = delta > 0;
  return (
    <span
      className={cn(
        "shrink-0 text-[11px] tabular-nums",
        up ? "text-[color:var(--warning)]" : "text-muted-foreground",
      )}
    >
      {up ? "↑" : "↓"} {up ? "+" : "−"}
      {formatNumber(Math.abs(delta))}
    </span>
  );
}

function VariableRow({ row }: { row: VariableBreakdownRow }) {
  const swatch = row.color ?? NEUTRAL_SWATCH;
  const showDelta = row.delta != null && row.delta !== 0;
  return (
    <li className="flex items-center gap-3 px-1 py-2">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${swatch}26`, color: swatch }}
      >
        <CategoryIcon slug={row.icon} className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-medium">{row.name}</span>
          <span className="shrink-0 text-[15px] font-semibold tabular-nums">
            {formatNumber(row.total)}원
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${row.share}%`, backgroundColor: swatch }}
            />
          </div>
          <span className="w-9 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
            {Math.round(row.share)}%
          </span>
          {showDelta ? <DeltaBadge delta={row.delta!} /> : null}
        </div>
      </div>
    </li>
  );
}

function FixedRow({ row }: { row: FixedBreakdownRow }) {
  const showDelta = row.delta != null && row.delta !== 0;
  return (
    <li className="flex items-center gap-3 px-1 py-2">
      <FixedCategoryBadge category={row.category} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0 truncate">
            <span className="text-[15px] font-medium">{row.name}</span>
            {row.planName ? (
              <span className="ml-1.5 text-[12px] text-muted-foreground">
                {row.planName}
              </span>
            ) : null}
          </div>
          <span className="shrink-0 text-[15px] font-semibold tabular-nums">
            {formatNumber(row.amount)}원
          </span>
        </div>
        {showDelta ? (
          <div className="mt-0.5">
            <DeltaBadge delta={row.delta!} />
          </div>
        ) : null}
      </div>
    </li>
  );
}
