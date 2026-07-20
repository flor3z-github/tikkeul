"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";

import {
  IncomeFormDialog,
  type IncomeAdjustmentInitial,
} from "@/components/income/income-form-dialog";
import { MonthlyIncomeSheet } from "@/components/income/monthly-income-sheet";
import { Card, CardContent } from "@/components/ui/card";
import { formatKoreanShortDate } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/money";

export type IncomeAdjustmentItem = {
  id: string;
  amount: number;
  occurredOn: string;
  memo: string | null;
};

type IncomeViewProps = {
  monthlyIncome: number;
  items: IncomeAdjustmentItem[];
  /** YYYY-MM-DD, inclusive cycle start. */
  cycleStartDate: string;
  /** YYYY-MM-DD, exclusive cycle end. */
  cycleEndDate: string;
  isCurrentCycle: boolean;
  // Future cycles can't accept entries — server rejects future dates — so the add button hides.
  isFutureCycle: boolean;
  /** YYYY-MM-DD pre-fill for the add form (today, or past cycle's last day). */
  addDefaultDate: string;
};

// Parse YYYY-MM-DD into a local-midnight Date — matches IncomeFormDialog's
// own parsing so calendar boundary checks line up (no UTC drift).
function parseYmd(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function IncomeView({
  monthlyIncome,
  items,
  cycleStartDate,
  cycleEndDate,
  isCurrentCycle,
  isFutureCycle,
  addDefaultDate,
}: IncomeViewProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeAdjustmentInitial | null>(null);
  const [monthlyOpen, setMonthlyOpen] = useState(false);

  const cycleStart = useMemo(() => parseYmd(cycleStartDate), [cycleStartDate]);
  const cycleEnd = useMemo(() => parseYmd(cycleEndDate), [cycleEndDate]);

  const extraTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.amount, 0),
    [items],
  );
  const total = monthlyIncome + extraTotal;

  return (
    <>
      {/* HERO — cycle total income (§3: the screen's biggest number). */}
      <Card className="mt-4 rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">
            이번 주기 총 수입
          </p>
          <p className="mt-2 flex items-baseline gap-1">
            <span className="text-[40px] font-bold leading-none tracking-[-0.045em] tabular-nums">
              {formatNumber(total)}
            </span>
            <span className="text-[19px] font-bold">원</span>
          </p>
          <p className="mt-2 text-[12px] tabular-nums text-muted-foreground">
            월 수입 {formatNumber(monthlyIncome)}원
            {extraTotal > 0 ? ` · 추가 ${formatNumber(extraTotal)}원` : ""}
          </p>
        </CardContent>
      </Card>

      {/* 월 수입 row — editable only on the live cycle. Past cycles show the
          hero breakdown alone (monthly income has no stored history; the
          displayed value is today's setting — a documented approximation). */}
      {isCurrentCycle ? (
        <Card className="mt-3 rounded-3xl border-black/[0.08] bg-card py-0 shadow-none dark:border-white/[0.10]">
          <CardContent className="p-2">
            <button
              type="button"
              onClick={() => setMonthlyOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-tight">월 수입</p>
                <p className="mt-0.5 text-[12px] leading-tight text-muted-foreground">
                  매달 들어오는 실수령 금액
                </p>
              </div>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                {formatNumber(monthlyIncome)}원
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </button>
          </CardContent>
        </Card>
      ) : null}

      {/* 추가 수입 list. */}
      <section className="mt-6 space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[15px] font-semibold tracking-[-0.015em]">
            추가 수입{" "}
            {items.length > 0 ? (
              <span className="font-medium tabular-nums text-muted-foreground/70">
                {items.length}
              </span>
            ) : null}
          </h2>
          {items.length > 0 ? (
            <span className="text-[12.5px] font-medium text-muted-foreground">
              최신순
            </span>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            이번 주기엔 추가 수입이 없어요.
          </p>
        ) : (
          <Card className="rounded-3xl border-black/[0.08] bg-card py-2 shadow-none dark:border-white/[0.10]">
            <CardContent className="p-2">
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted active:bg-muted"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold tabular-nums leading-tight">
                          +{formatNumber(item.amount)}원
                        </p>
                        <p className="mt-0.5 truncate text-[12px] leading-tight text-muted-foreground">
                          {formatKoreanShortDate(parseYmd(item.occurredOn))}
                          {item.memo ? ` · ${item.memo}` : ""}
                        </p>
                      </div>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

      </section>

      {/* FAB — add an income adjustment (same position/style as /savings).
          Hidden on future cycles: the server rejects future dates, so an add
          there could never succeed. */}
      {!isFutureCycle ? (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="추가 수입 기록"
          className="fixed right-6 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_-6px_rgba(0,122,255,0.55)] transition-transform duration-150 ease-out active:scale-95"
          style={{ bottom: "calc(var(--bottom-nav-clearance) + 16px)" }}
        >
          <Plus className="size-6" strokeWidth={2.6} />
        </button>
      ) : null}

      {/* Add / edit share the same drawer, keyed by initial (form-dialog
          pattern). Not nested — no parent drawer on this page. */}
      <IncomeFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        defaultDate={addDefaultDate}
      />
      <IncomeFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        defaultDate={editing?.occurredOn ?? addDefaultDate}
        initial={editing ?? undefined}
      />

      <MonthlyIncomeSheet
        open={monthlyOpen}
        onOpenChange={setMonthlyOpen}
        initialIncome={monthlyIncome}
      />
    </>
  );
}
