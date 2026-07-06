import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FixedCategoryBadge } from "@/lib/utils/fixed-category-icon";
import { formatKRW, formatNumber } from "@/lib/utils/money";
import type {
  FixedBreakdownRow,
  VariableBreakdownRow,
} from "@/lib/utils/stats/cycle-breakdown";
import type { PaymentSplit } from "@/lib/utils/stats/payment-split";
import {
  DeltaBadge,
  SectionHeading,
  SectionListCard,
  VariableSection,
} from "@/components/stats/variable-section";

type CycleBreakdownViewProps = {
  cycleLabel: string;
  grandTotal: number;
  variableTotal: number;
  fixedTotal: number;
  variableRows: VariableBreakdownRow[];
  fixedRows: FixedBreakdownRow[];
  paymentSplit: PaymentSplit;
  /** 이번 달 모으기액(저축+투자, 현재 사이클일 때만 > 0). 대시보드 「나간 돈」은 모으기를
   *  포함하지만 /stats 총액은 「총 소비」(고정+변동)라 모으기가 빠진다 — 그 괴리를
   *  히어로에 명시한다. 코드 식별자는 savings_plans/thisMonthSaved 도메인을 따르지만
   *  사용자 카피는 브랜드어 「모으기」로 통일(저축은 투자를 배제하는 좁은 말). */
  savingsExcluded?: number;
};

/**
 * /stats 본문 — "이번 사이클에 돈이 어디로 갔나"를 변동(카테고리 집계, % 비중)과
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
  paymentSplit,
  savingsExcluded = 0,
}: CycleBreakdownViewProps) {
  const isEmpty =
    grandTotal === 0 && variableRows.length === 0 && fixedRows.length === 0;
  // Only show the 결제수단 split once at least one row carries a real method —
  // an all-미지정 split (every row legacy/untagged) is noise, not a split.
  const showPaymentSplit = paymentSplit.rows.some((r) => r.method !== "unknown");

  return (
    <div className="space-y-6">
      {/* 상단 총 소비 — 대시보드 '쓴 돈'과 정확히 같은 값. 대시보드 SpendingSummary
          히어로와 같은 카드 셸(진행바만 없음). */}
      <Card className="rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
        <CardContent className="space-y-1.5 px-6 py-4">
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
          {savingsExcluded > 0 ? (
            <p className="text-[12px] text-muted-foreground/80">
              모으기 {formatKRW(savingsExcluded)}은 소비가 아니라 따로 빠져요
            </p>
          ) : null}
        </CardContent>
      </Card>

      {isEmpty ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
          이번 주기엔 아직 기록이 없어요.
        </p>
      ) : null}

      {variableRows.length > 0 ? (
        <VariableSection
          variableRows={variableRows}
          variableTotal={variableTotal}
          paymentSplit={showPaymentSplit ? paymentSplit : null}
        />
      ) : null}

      {fixedRows.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading
            title="고정지출"
            total={fixedTotal}
            hint={
              fixedRows.some((r) => r.delta != null && r.delta !== 0)
                ? "↑↓ 직전 주기 대비"
                : undefined
            }
          />
          <SectionListCard>
            <ul>
              {fixedRows.map((row, i) => (
                <FixedRow
                  key={row.id}
                  row={row}
                  groupBreak={i > 0 && row.category !== fixedRows[i - 1].category}
                />
              ))}
            </ul>
          </SectionListCard>
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
function FixedRow({
  row,
  groupBreak = false,
}: {
  row: FixedBreakdownRow;
  /** 앞 행과 카탈로그 그룹(`category`)이 바뀌는 경계 — 소제목 없이(§12.9 line 1238)
   *  hairline 구분선으로 그룹을 가른다(line 1246이 구분선 허용). 같은 fallback 아이콘이
   *  연속돼 정렬이 버그처럼 읽히는 것을 막는다. */
  groupBreak?: boolean;
}) {
  const showDelta = row.delta != null && row.delta !== 0;
  return (
    <li
      className={cn(
        "flex items-center gap-3 px-1 py-2",
        groupBreak && "mt-1.5 border-t border-dashed border-border/70 pt-3.5",
      )}
    >
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

