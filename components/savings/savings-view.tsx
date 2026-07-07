"use client";

import { useMemo, useState } from "react";
import { Plus, Sprout } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useStableNonNull } from "@/components/ui/bottom-sheet";
import { formatKRW, formatNumber } from "@/lib/utils/money";
import {
  comparePaymentDayUpcoming,
  formatPaymentDay,
} from "@/lib/utils/payment-day";
import {
  maturityProgressPct,
  remainingLabel,
  thisMonthSaved,
  type SavingsPlanRow,
} from "@/lib/utils/savings";
import { SavingsFormSheet } from "./savings-form-sheet";

type SavingsViewProps = {
  plans: SavingsPlanRow[];
  /** Server-resolved KST today 'YYYY-MM-DD'. */
  nowISO: string;
};

export function SavingsView({ plans, nowISO }: SavingsViewProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<SavingsPlanRow | null>(null);
  // Retain the last item so the edit sheet keeps its fields during vaul's close
  // animation (BottomSheet always renders children — see its JSDoc).
  const stableEdit = useStableNonNull(editItem);

  // Reconstruct `now` from date components so labels match the server's KST
  // reading regardless of the browser timezone (no `new Date(nowISO)` UTC drift).
  const now = useMemo(() => {
    const [y, m, d] = nowISO.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [nowISO]);

  const active = useMemo(() => plans.filter((p) => p.is_active), [plans]);

  // Sorted by upcoming 적립일 (fixed-expenses parity). No payment_day → amount desc.
  const sorted = useMemo(() => {
    return [...active].sort((a, b) => {
      const cmp = comparePaymentDayUpcoming(now, a.payment_day, b.payment_day);
      if (cmp !== 0) return cmp;
      return (b.amount ?? 0) - (a.amount ?? 0);
    });
  }, [active, now]);

  const monthSaved = useMemo(() => thisMonthSaved(active, now), [active, now]);
  const isEmpty = active.length === 0;

  return (
    <>
      {/* HERO — this month's contribution + item count. */}
      <Card className="rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              매달 모으는 돈
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground tabular-nums">
              <span aria-hidden className="size-1.5 rounded-full bg-[#1c8c4d]" />총{" "}
              {active.length}개 항목
            </span>
          </div>
          <p className="mt-2 flex items-baseline gap-1">
            <span className="text-[40px] font-bold leading-none tracking-[-0.045em] tabular-nums">
              {formatNumber(monthSaved)}
            </span>
            <span className="text-[19px] font-bold">원</span>
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground">
            쓴 게 아니라{" "}
            <span className="font-semibold text-[#1c8c4d]">
              다시 내 자산이 되는 돈
            </span>
            이에요
          </p>
        </CardContent>
      </Card>

      {isEmpty ? (
        <div className="mt-8 rounded-3xl border border-dashed border-border px-5 py-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#1c8c4d]/10">
            <Sprout className="size-6 text-[#1c8c4d]" />
          </div>
          <p className="mt-4 text-[15px] font-semibold">
            아직 모으는 항목이 없어요
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            적금·투자를 추가하면
            <br />
            매달 모으는 돈을 한눈에 볼 수 있어요.
          </p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-primary-foreground transition-all duration-150 ease-out active:scale-[0.98]"
          >
            <Plus className="size-4" strokeWidth={2.6} />
            <span className="text-[14px] font-semibold">첫 항목 추가하기</span>
          </button>
        </div>
      ) : (
        <section className="mt-6 space-y-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[15px] font-semibold tracking-[-0.015em]">
              모으는 중{" "}
              <span className="font-medium tabular-nums text-muted-foreground/70">
                {active.length}
              </span>
            </h2>
            <span className="text-[12.5px] font-medium text-muted-foreground">
              적립일 순
            </span>
          </div>
          <Card className="rounded-3xl border-black/[0.08] bg-card py-2 shadow-none dark:border-white/[0.10]">
            <CardContent className="p-2">
              <ul className="space-y-0.5">
                {sorted.map((item) => (
                  <li key={item.id}>
                    <SavingsRow
                      item={item}
                      now={now}
                      onClick={() => setEditItem(item)}
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* FAB — add a savings plan. */}
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="돈모으기 추가"
        className="fixed right-6 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_-6px_rgba(0,122,255,0.55)] transition-transform duration-150 ease-out active:scale-95"
        style={{ bottom: "calc(76px + env(safe-area-inset-bottom) + 16px)" }}
      >
        <Plus className="size-6" strokeWidth={2.6} />
      </button>

      <SavingsFormSheet open={addOpen} onOpenChange={setAddOpen} todayISO={nowISO} />
      <SavingsFormSheet
        open={editItem !== null}
        onOpenChange={(open) => {
          if (!open) setEditItem(null);
        }}
        initial={stableEdit}
        todayISO={nowISO}
      />
    </>
  );
}

function metaLabel(item: SavingsPlanRow): string {
  const day = formatPaymentDay(item.payment_day);
  return day ? `매월 ${day}` : "적립일 미정";
}

// 'YYYY-MM-DD' → 'Y.M.D' (leading zeros dropped). Parsed by split, NOT
// `new Date(string)`, so it stays on the KST wall-clock day (no UTC drift).
function formatDotDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}.${m}.${d}`;
}

function SavingsRow({
  item,
  now,
  onClick,
}: {
  item: SavingsPlanRow;
  now: Date;
  onClick: () => void;
}) {
  const maturity = remainingLabel(item, now);
  // Time-based term progress — only 만기 items get a bar (자유 적립/투자 has no
  // term). NOT goal-amount progress; that concept was removed.
  const pct = maturityProgressPct(item, now);
  const metaParts = [metaLabel(item)];
  if (maturity) metaParts.push(maturity);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted active:bg-muted"
    >
      <div className="flex w-full items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-tight">
            {item.name}
          </p>
          <p className="mt-0.5 truncate text-[12px] leading-tight text-muted-foreground">
            {metaParts.join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end leading-tight">
          <span
            className={
              item.amount == null
                ? "text-[15px] font-semibold tabular-nums text-muted-foreground/70"
                : "text-[15px] font-semibold tabular-nums"
            }
          >
            {item.amount == null ? "금액 미입력" : formatKRW(item.amount)}
          </span>
        </div>
      </div>
      {pct != null && item.maturity_date != null ? (
        <div className="mt-2.5 w-full">
          <div
            role="progressbar"
            aria-label="만기까지 진행률"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-[7px] w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-[#1c8c4d] transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* Dates anchor the bar ends — 시작일 left, 만기일 right — so the fill
              visually reads as "from start to maturity". */}
          <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
            <span>{formatDotDate(item.start_date)}</span>
            <span>{formatDotDate(item.maturity_date)}</span>
          </div>
        </div>
      ) : null}
    </button>
  );
}
