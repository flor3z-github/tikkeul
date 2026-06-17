import { FixedCategoryBadge } from "@/lib/utils/fixed-category-icon";
import { formatKRW, formatNumber } from "@/lib/utils/money";
import type {
  FixedBreakdownRow,
  VariableBreakdownRow,
} from "@/lib/utils/stats/cycle-breakdown";
import {
  DeltaBadge,
  SectionHeading,
  VariableSection,
} from "@/components/stats/variable-section";

type CycleBreakdownViewProps = {
  cycleLabel: string;
  grandTotal: number;
  variableTotal: number;
  fixedTotal: number;
  variableRows: VariableBreakdownRow[];
  fixedRows: FixedBreakdownRow[];
};

/**
 * /stats 본문 — "이번 사이클에 돈이 어디로 갔나"를 변동(카테고리 집계, CSS 막대)과
 * 고정(카탈로그 그룹, 항목별)으로 분해한다 (§12.9). 차트 없이 분해 리스트만, surface
 * 1단계. 변동 카테고리별·고정 항목별에 직전 사이클 대비 ±delta를 단다(상단 총액의
 * 전월比 verdict는 두지 않는다 — 추세는 대시보드의 일, /stats는 구성에 집중 §3.3).
 */
export function CycleBreakdownView({
  cycleLabel,
  grandTotal,
  variableTotal,
  fixedTotal,
  variableRows,
  fixedRows,
}: CycleBreakdownViewProps) {
  const isEmpty =
    grandTotal === 0 && variableRows.length === 0 && fixedRows.length === 0;

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
      </div>

      {isEmpty ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
          이번 주기엔 아직 기록이 없어요.
        </p>
      ) : null}

      {variableRows.length > 0 ? (
        <VariableSection
          variableRows={variableRows}
          variableTotal={variableTotal}
        />
      ) : null}

      {variableRows.length > 0 && fixedRows.length > 0 ? (
        <hr aria-hidden className="border-border" />
      ) : null}

      {fixedRows.length > 0 ? (
        <section className="space-y-1">
          <SectionHeading title="고정지출" total={fixedTotal} />
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

/**
 * 고정 행. 이름(좌)·금액(우)을 한 줄에 두고 inner `items-center`로 정렬 → 둘 다 블록
 * 세로 center에 와 같은 라인에 놓인다. delta는 (잠정) 금액 아래 `absolute`라 행 높이·
 * 이름/금액 centering에 영향 없음 — delta 위치는 추후 재검토. 아이콘(40px)이 최대
 * 높이라 행 높이는 통일.
 */
function FixedRow({ row }: { row: FixedBreakdownRow }) {
  const showDelta = row.delta != null && row.delta !== 0;
  return (
    <li className="flex items-center gap-3 px-1 py-2">
      <FixedCategoryBadge category={row.category} />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium">{row.name}</p>
          {row.planName ? (
            <p className="truncate text-[13px] text-muted-foreground">
              {row.planName}
            </p>
          ) : null}
        </div>
        <div className="relative shrink-0 text-right">
          <p className="text-[15px] font-semibold tabular-nums">
            {formatNumber(row.amount)}원
          </p>
          {showDelta ? (
            // 잠정: 금액 바로 아래 absolute. 추후 위치 결정.
            <div className="absolute right-0 top-full -mt-1">
              <DeltaBadge delta={row.delta!} />
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
