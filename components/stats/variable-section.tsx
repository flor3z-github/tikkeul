"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { CategoryIcon } from "@/lib/utils/category-icon";
import { cn } from "@/lib/utils";
import { formatKoreanShortDate } from "@/lib/utils/date";
import { formatKRW, formatNumber } from "@/lib/utils/money";
import type { VariableBreakdownRow } from "@/lib/utils/stats/cycle-breakdown";

const NEUTRAL_SWATCH = "#8E8E93";

/** Shared by the variable rows and the (server-rendered) fixed rows. */
export function SectionHeading({
  title,
  total,
}: {
  title: string;
  total: number;
}) {
  return (
    <div className="flex items-baseline justify-between px-1 pb-1">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
      <span className="text-[13px] tabular-nums text-muted-foreground">
        {formatKRW(total)}
      </span>
    </div>
  );
}

/** 직전 사이클 대비 ±N. up(더 씀)=destructive(빨강), down(덜 씀)=success(녹색). */
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
 * 변동지출 섹션 — 카테고리 집계 행. 행을 탭하면 그 카테고리의 개별 거래를 아래로
 * 펼친다(§12.9 drill-down). exclusive accordion: 한 번에 한 카테고리만 열린다 —
 * 새 행을 열면 이전 것이 닫힌다. own 전용 화면이므로 거래 날짜·메모를 그대로 노출한다.
 */
export function VariableSection({
  variableRows,
  variableTotal,
}: {
  variableRows: VariableBreakdownRow[];
  variableTotal: number;
}) {
  // null = 모두 닫힘. 키는 categoryId(미분류는 "__uncat__").
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <section className="space-y-1">
      <SectionHeading title="변동지출" total={variableTotal} />
      <ul>
        {variableRows.map((row) => {
          const key = row.categoryId ?? "__uncat__";
          return (
            <VariableRow
              key={key}
              row={row}
              open={openKey === key}
              onToggle={() =>
                setOpenKey((cur) => (cur === key ? null : key))
              }
            />
          );
        })}
      </ul>
    </section>
  );
}

function VariableRow({
  row,
  open,
  onToggle,
}: {
  row: VariableBreakdownRow;
  open: boolean;
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
        {/* 토스식 2줄: 왼쪽 이름/비중(%), 오른쪽 금액/전월比 delta. */}
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
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
          className="mb-1 ml-[52px] space-y-0.5 border-l border-border pl-3 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {row.items.map((item) => (
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
