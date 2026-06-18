"use client";

import { useMemo, useState } from "react";
import { Plus, Sprout } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useStableNonNull } from "@/components/ui/bottom-sheet";
import { formatKRW, formatNumber } from "@/lib/utils/money";
import { formatPaymentDay } from "@/lib/utils/payment-day";
import {
  accruedAmount,
  isGoalType,
  progressPct,
  remainingLabel,
  thisMonthSaved,
  yearSaved,
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
  // Retain the last item so the edit sheet keeps its title/fields during vaul's
  // close animation (BottomSheet always renders children — see its JSDoc).
  const stableEdit = useStableNonNull(editItem);

  // Reconstruct `now` from date components so accrual matches the server's KST
  // reading regardless of the browser timezone (no `new Date(nowISO)` UTC drift).
  const now = useMemo(() => {
    const [y, m, d] = nowISO.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [nowISO]);

  const active = useMemo(() => plans.filter((p) => p.is_active), [plans]);
  const freeItems = useMemo(() => active.filter((p) => !isGoalType(p)), [active]);
  const goalItems = useMemo(() => active.filter((p) => isGoalType(p)), [active]);

  const monthSaved = useMemo(() => thisMonthSaved(active, now), [active, now]);
  const totalYearSaved = useMemo(() => yearSaved(active, now), [active, now]);

  const isEmpty = active.length === 0;

  return (
    <>
      {/* HERO — this month's contribution + year-to-date. */}
      <Card className="rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">
            이번 달 모은 돈
          </p>
          <p className="mt-2 flex items-baseline gap-1">
            <span className="text-[40px] font-bold leading-none tracking-[-0.045em] tabular-nums">
              {formatNumber(monthSaved)}
            </span>
            <span className="text-[19px] font-bold">원</span>
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground">
            쓴 게 아니라{" "}
            <span className="font-semibold text-primary">
              다시 내 자산이 되는 돈
            </span>
            이에요
          </p>
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-primary/10 px-4 py-3.5">
            <span className="text-[12.5px] font-semibold text-primary">
              올해 모은 돈
            </span>
            <span className="text-[17px] font-bold tabular-nums">
              {formatKRW(totalYearSaved)}
            </span>
          </div>
        </CardContent>
      </Card>

      {isEmpty ? (
        <div className="mt-8 rounded-3xl border border-dashed border-border px-5 py-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Sprout className="size-6 text-primary" />
          </div>
          <p className="mt-4 text-[15px] font-semibold">
            아직 모으는 항목이 없어요
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            적금·투자·목표를 추가하면
            <br />
            매달 모이는 돈을 한눈에 볼 수 있어요.
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
      ) : null}

      {/* 섹션 A — 투자·자유 적립 (no goal / no maturity → numbers only). */}
      {freeItems.length > 0 ? (
        <section className="mt-6 space-y-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[15px] font-semibold tracking-[-0.015em]">
              투자·자유 적립{" "}
              <span className="font-medium tabular-nums text-muted-foreground/70">
                {freeItems.length}
              </span>
            </h2>
            <span className="text-[12.5px] font-medium text-muted-foreground">
              만기 없이 모으는 중
            </span>
          </div>
          <Card className="rounded-3xl border-black/[0.08] bg-card py-2 shadow-none dark:border-white/[0.10]">
            <CardContent className="p-2">
              <ul className="space-y-0.5">
                {freeItems.map((item) => (
                  <li key={item.id}>
                    <FreeRow
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
      ) : null}

      {/* 섹션 B — 달성형 목표 (goal or maturity → progress bar). */}
      {goalItems.length > 0 ? (
        <section className="mt-6 space-y-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[15px] font-semibold tracking-[-0.015em]">
              달성형 목표{" "}
              <span className="font-medium tabular-nums text-muted-foreground/70">
                {goalItems.length}
              </span>
            </h2>
            <span className="text-[12.5px] font-medium text-muted-foreground">
              목표까지 진행률
            </span>
          </div>
          <Card className="rounded-3xl border-black/[0.08] bg-card py-2 shadow-none dark:border-white/[0.10]">
            <CardContent className="p-2">
              <ul className="space-y-0.5">
                {goalItems.map((item) => (
                  <li key={item.id}>
                    <GoalRow
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
      ) : null}

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

function FreeRow({
  item,
  now,
  onClick,
}: {
  item: SavingsPlanRow;
  now: Date;
  onClick: () => void;
}) {
  const monthly = item.amount ?? 0;
  const accrued = accruedAmount(item, now);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted active:bg-muted"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium leading-tight">
          {item.name}
        </p>
        <p className="mt-0.5 truncate text-[12px] leading-tight text-muted-foreground">
          {accrued > 0
            ? `${metaLabel(item)} · 모은 돈 ${formatKRW(accrued)}`
            : `${metaLabel(item)} · 만기 없음`}
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
          {item.amount == null ? "금액 미입력" : formatKRW(monthly)}
        </span>
        {item.amount != null ? (
          <span className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
            연 {formatKRW(monthly * 12)}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function GoalRow({
  item,
  now,
  onClick,
}: {
  item: SavingsPlanRow;
  now: Date;
  onClick: () => void;
}) {
  const pct = progressPct(item, now);
  const remaining = remainingLabel(item, now);
  const current = accruedAmount(item, now);
  const monthly = item.amount ?? 0;
  const metaParts = [metaLabel(item)];
  if (item.amount != null) metaParts.push(`${formatNumber(monthly)}원 적립`);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col rounded-2xl px-3 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-tight">
            {item.name}
          </p>
          <p className="mt-0.5 truncate text-[12px] leading-tight text-muted-foreground">
            {metaParts.join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end leading-tight">
          {pct != null ? (
            <span className="text-[12.5px] font-bold tabular-nums text-primary">
              {pct}%
            </span>
          ) : null}
          {remaining ? (
            <span className="mt-0.5 text-[10.5px] font-medium text-muted-foreground">
              {remaining}
            </span>
          ) : null}
        </div>
      </div>

      {pct != null ? (
        <div className="mt-2.5 w-full">
          <div className="h-[7px] w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          {item.goal_amount != null ? (
            <p className="mt-1.5 text-right text-[11.5px] tabular-nums text-muted-foreground">
              {formatNumber(current)} /{" "}
              <span className="font-semibold text-foreground/80">
                {formatNumber(item.goal_amount)}원
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}
