"use client";

import { type ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/lib/utils/category-icon";
import { cn } from "@/lib/utils";
import { formatKoreanShortDate } from "@/lib/utils/date";
import { formatKRW, formatNumber } from "@/lib/utils/money";
import { PAYMENT_METHOD_SHORT_LABELS } from "@/lib/utils/payment-method";
import {
  sortVariableItems,
  type VariableBreakdownRow,
  type VariableItemSortMode,
} from "@/lib/utils/stats/cycle-breakdown";
import type { PaymentSplit } from "@/lib/utils/stats/payment-split";

const NEUTRAL_SWATCH = "#8E8E93";

/** Shared by the variable rows and the (server-rendered) fixed rows. `hint` is a
 *  subtle sub-line under the title — used to name the ↑/↓ delta baseline (직전
 *  주기 대비), shown only when the section actually has deltas. */
export function SectionHeading({
  title,
  total,
  hint,
}: {
  title: string;
  total: number;
  hint?: string;
}) {
  return (
    <div className="px-1 pb-1">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        <span className="text-[13px] tabular-nums text-muted-foreground">
          {formatKRW(total)}
        </span>
      </div>
      {hint ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * 직전 사이클 대비 ±N. 더 씀=↑ destructive(빨강), 덜 씀=↓ success(초록). 금융 UI의
 * 관습색으로 전월比를 즉시 읽히게 하려는 선택(§12.9) — 이 한 표기에 한해 §4.3의
 * 빨강/초록 절제 원칙보다 가독성을 우선한다(경만님 확정 2026-07-06).
 */
export function DeltaBadge({ delta }: { delta: number }) {
  const up = delta > 0;
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap text-[11px] tabular-nums",
        up
          ? "text-[color:var(--destructive)]"
          : "text-[color:var(--success)]",
      )}
    >
      {up ? "↑" : "↓"} {formatNumber(Math.abs(delta))}원
    </span>
  );
}

/**
 * 섹션의 행 리스트(ul)만 감싸는 카드 셸 — 헤더(SectionHeading)는 카드 밖에 두는
 * 대시보드 구조를 미러링한다. 세로(Card `py-2` + CardContent `py-2` = 16px)는
 * day-panel과 같지만, 가로는 `px-4`로 넓혀 상단 히어로 카드(px-6=24px)와의 좌우
 * 인셋 격차를 줄인다(행 자체 `px-1` 포함 ≈20px). day-panel의 `p-2`(8px)를 그대로
 * 쓰면 히어로 대비 절반이라 stats처럼 카드가 쌓일 때 리스트가 쪼그라들어 보인다.
 */
export function SectionListCard({ children }: { children: ReactNode }) {
  return (
    <Card className="rounded-3xl border-black/[0.08] bg-card py-2 shadow-none dark:border-white/[0.10]">
      <CardContent className="px-4 py-2">{children}</CardContent>
    </Card>
  );
}

/**
 * 변동지출 섹션 — 카테고리 집계 행. 행을 탭하면 그 카테고리의 개별 거래를 아래로
 * 펼친다(§12.9 drill-down). exclusive accordion: 한 번에 한 카테고리만 열린다 —
 * 새 행을 열면 이전 것이 닫힌다. own 전용 화면이므로 거래 날짜·메모를 그대로 노출한다.
 */
export function VariableSection({
  variableRows,
  variableTotal,
  paymentSplit,
}: {
  variableRows: VariableBreakdownRow[];
  variableTotal: number;
  /** 결제수단 분해 — 변동지출을 신용/체크로 다시 자른 것(분모=변동 총액). 변동의
   *  부분 슬라이스라 별도 peer 카드가 아니라 이 카드 안에 nest한다. null이면 숨김. */
  paymentSplit: PaymentSplit | null;
}) {
  // null = 모두 닫힘. 키는 categoryId(미분류는 "__uncat__").
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Section-global sort for the expanded drill-down lists. Default "amount"
  // preserves the pre-toggle behavior; in-memory only (no localStorage) since
  // sorting is a transient exploration state, not a lasting preference.
  const [sortMode, setSortMode] = useState<VariableItemSortMode>("amount");
  // delta가 하나라도 있을 때만 기준선 힌트를 단다 — 첫 사이클(전월比 off)엔 노이즈.
  const hasDelta = variableRows.some((r) => r.delta != null && r.delta !== 0);

  return (
    <section className="space-y-3">
      <SectionHeading
        title="변동지출"
        total={variableTotal}
        hint={hasDelta ? "↑↓ 직전 주기 같은 때 대비" : undefined}
      />
      <SortToggle mode={sortMode} onChange={setSortMode} />
      <SectionListCard>
        <ul>
          {variableRows.map((row) => {
            const key = row.categoryId ?? "__uncat__";
            return (
              <VariableRow
                key={key}
                row={row}
                open={openKey === key}
                sortMode={sortMode}
                onToggle={() =>
                  setOpenKey((cur) => (cur === key ? null : key))
                }
              />
            );
          })}
        </ul>
        {paymentSplit ? <NestedPaymentSplit split={paymentSplit} /> : null}
      </SectionListCard>
    </section>
  );
}

const SORT_OPTIONS: { mode: VariableItemSortMode; label: string }[] = [
  { mode: "amount", label: "금액순" },
  { mode: "date", label: "날짜순" },
];

/**
 * Section-global sort toggle for the expanded transaction lists (§12.9). Two
 * plain text buttons (no shadcn Tabs — §9) right-aligned between the heading
 * and the list card; the active mode is emphasized via color/weight only.
 */
function SortToggle({
  mode,
  onChange,
}: {
  mode: VariableItemSortMode;
  onChange: (mode: VariableItemSortMode) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-3 px-1">
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.mode}
          type="button"
          aria-pressed={mode === opt.mode}
          onClick={() => onChange(opt.mode)}
          className={cn(
            "text-[12px] transition-colors",
            mode === opt.mode
              ? "font-semibold text-foreground"
              : "text-muted-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 결제수단 분해를 변동지출 카드 안에 nest한 서브 블록(§12.9). 변동 총액을 신용/체크로
 * 다시 자른 것이라(분모=변동 총액) top-level peer가 아니라 카테고리 행 아래 구분선 +
 * 「결제수단」 서브 헤딩으로 종속시킨다 — 같은 총액을 두 관점(카테고리/결제수단)으로
 * 본다는 관계를 드러내고, 중복 총액 헤딩을 없앤다. 차트 없음(§19).
 */
function NestedPaymentSplit({ split }: { split: PaymentSplit }) {
  return (
    <div className="mt-2 border-t border-dashed border-border/70 pt-3">
      <h3 className="mb-0.5 px-1 text-[13px] font-semibold text-muted-foreground">
        결제수단
      </h3>
      <ul>
        {split.rows.map((row) => (
          <li
            key={row.method}
            className="flex items-center justify-between gap-3 px-1 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-medium">
                {row.method === "unknown"
                  ? "미지정"
                  : PAYMENT_METHOD_SHORT_LABELS[row.method]}
              </span>
              <span className="text-[13px] tabular-nums text-muted-foreground">
                {Math.round(row.share)}%
              </span>
            </div>
            <span className="shrink-0 text-[15px] font-semibold tabular-nums">
              {formatNumber(row.total)}원
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VariableRow({
  row,
  open,
  sortMode,
  onToggle,
}: {
  row: VariableBreakdownRow;
  open: boolean;
  sortMode: VariableItemSortMode;
  onToggle: () => void;
}) {
  const swatch = row.color ?? NEUTRAL_SWATCH;
  const showDelta = row.delta != null && row.delta !== 0;
  const panelId = `var-items-${row.categoryId ?? "__uncat__"}`;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-colors active:bg-muted/60"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${swatch}26`, color: swatch }}
        >
          <CategoryIcon slug={row.icon} className="size-5" />
        </span>
        {/* 위: 왼쪽 이름/비중(%)·오른쪽 금액/전월比 delta. 아래: 비중 막대. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium">{row.name}</p>
              <p className="text-[13px] tabular-nums text-muted-foreground">
                {Math.round(row.share)}%
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] font-semibold tabular-nums">
                {formatNumber(row.total)}원
              </p>
              {showDelta ? <DeltaBadge delta={row.delta!} /> : null}
            </div>
          </div>
          {/* 변동 섹션 내 비중을 나타내는 CSS 막대(§12.9 line 1236, 자기 정규화 Σ≈100).
              카테고리 색으로 채운다 — Recharts가 아닌 인라인 막대라 §19와 무관. */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, row.share)}%`,
                backgroundColor: swatch,
              }}
            />
          </div>
        </div>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <ul
          id={panelId}
          // pr-8(32px) = 부모 행 금액의 우측 인셋(버튼 px-1 4 + chevron 16 + gap-3 12)과
          // 맞춰, 펼친 거래 금액의 오른쪽 세로 라인이 부모 금액과 정렬되게 한다(chevron이
          // 없는 자식 행이 카드 끝까지 튀어나가는 것 방지).
          className="mb-1 ml-[52px] space-y-0.5 border-l border-border pl-3 pr-8 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {sortVariableItems(row.items, sortMode).map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 py-1.5"
            >
              <div className="min-w-0">
                <p className="text-[13px] tabular-nums text-muted-foreground">
                  {formatKoreanShortDate(item.spentAt)}
                </p>
                {item.memo ? (
                  <p className="truncate text-[13px] text-foreground/80">
                    {item.memo}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-[14px] font-medium tabular-nums">
                {formatNumber(item.amount)}원
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
