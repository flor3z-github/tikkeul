"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronDown, PiggyBank } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FixedOverrideDialog,
  type FixedOverrideTarget,
} from "@/components/dashboard/fixed-override-dialog";
import {
  UndatedFixedDialog,
  type UndatedFixedTarget,
} from "@/components/dashboard/undated-fixed-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { SpendingMonthGrid } from "@/components/calendar/spending-month-grid";
import { MonthSwitcher } from "@/app/dashboard/_components/month-switcher";
import { buttonVariants } from "@/components/ui/button";
import {
  TransactionItem,
  type TransactionListRow,
} from "@/components/transactions/transaction-item";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import type {
  TransactionFormCategory,
  TransactionFormGroup,
} from "@/components/transactions/transaction-form-dialog";
import type { MonthlyTransaction } from "@/lib/queries/transactions";
import { cn } from "@/lib/utils";
import {
  type CycleMode,
  formatKoreanLongDate,
} from "@/lib/utils/calendar";
import { toISODate } from "@/lib/utils/date";
import { formatKRW } from "@/lib/utils/money";
import { FixedCategoryBadge } from "@/lib/utils/fixed-category-icon";

export type InteractionMode = "emoji" | "comment";

export type CalendarFixedExpenseItem = {
  id: string;
  name: string;
  plan_name: string | null;
  /** Effective amount for the cycle (override ?? base); NULL = "금액 미입력". */
  amount: number | null;
  /** Monthly base amount; NULL = 미입력. Own mode only (NULL in friend mode). */
  baseAmount: number | null;
  /** Catalog category text (AI/OTT/…) → row icon; NULL for manual items. */
  category: string | null;
  /** True when this cycle's amount was overridden. Own mode only. */
  isOverridden: boolean;
  payment_day: number | null;
};

export type CalendarSavingsItem = {
  id: string;
  name: string;
  /** Monthly contribution; NULL = 금액 미입력. */
  amount: number | null;
  payment_day: number | null;
};

type CalendarDayPanelProps = {
  ym: string;
  initialDay: string;
  cycleStart: Date;
  cycleEnd: Date;
  cycleMode: CycleMode;
  cycleLabel: string;
  transactions: MonthlyTransaction[];
  categories: TransactionFormCategory[];
  /** Own-mode only: the viewer's friend groups (seed + user-defined), forwarded
   *  to the edit form / FAB so the visibility selector can render. Empty in
   *  friend mode (no edit affordance) or until the data loads. */
  groups?: TransactionFormGroup[];
  /** Daily-classification baseline forwarded to the grid: the cycle's full
   *  inflow pool (income + 추가수입), NOT income − fixed (B-full: fixed is
   *  folded into each day's amount, so subtracting it here too double-counts). */
  cycleBudget: number;
  /** True when the viewer is looking at their own dashboard. */
  isOwn: boolean;
  /** Transaction owner's user_id — same as the viewer in own mode, the friend's
   *  user_id in friend mode. Forwarded to TransactionItem so the "전체 대화"
   *  link routes to /dm/<ownerUserId>. */
  ownerUserId: string;
  /** Friend mode only: viewer's last emoji-only reaction per transaction id. */
  lastEmojiByTx?: Record<string, string>;
  /** Friend mode only: viewer's most recent text comment per transaction id.
   *  Surfaces as a read-only trace next to the message icon — never editable
   *  from the row itself; the DM page is the source of truth. */
  lastCommentByTx?: Record<string, string>;
  /** Friend mode only: dm_messages.id corresponding to each lastComment. Lets
   *  the comment trace deep-link straight to that message in the DM thread. */
  lastCommentMessageIdByTx?: Record<string, string>;
  /** Own mode only: most recent text comment a friend left on each of the
   *  owner's transactions. Renders an incoming-comment trace under the row
   *  that deep-links to the DM message. Empty in friend mode. */
  incomingCommentByTx?: Record<string, string>;
  incomingCommentMessageIdByTx?: Record<string, string>;
  incomingCommentSenderIdByTx?: Record<string, string>;
  incomingCommentSenderNameByTx?: Record<string, string>;
  incomingCommentUnreadByTx?: Record<string, boolean>;
  /** Own-mode only: fixed expenses scheduled to fire on each YYYY-MM-DD in
   *  the visible cycle. Drives the calendar marker + the per-day section. */
  fixedExpensesByDay?: Record<string, CalendarFixedExpenseItem[]>;
  /** Own-mode only: active fixed expenses with no payment_day — they have no
   *  calendar day, so the per-day override edit can't reach them. Surfaced as
   *  a nudge pointing to /fixed-expenses to set a payment day. */
  undatedFixedExpenses?: CalendarFixedExpenseItem[];
  /** Own-mode only: savings deposits scheduled on each YYYY-MM-DD in the visible
   *  cycle. Renders a green calendar marker + a 「모으기」 day-panel row, but is
   *  EXCLUDED from the day total and cell classification (저축 ≠ 소비, §12.6).
   *  In friend mode only populated when the owner granted show_savings_items
   *  (the section fetches it via a perm-gated RPC). */
  savingsByDay?: Record<string, CalendarSavingsItem[]>;
  /** Whether savings markers/rows may render: own mode, or a friend the owner
   *  granted show_savings_items. Gates the render in addition to the data being
   *  present (defense in depth — savings is private, §12.10). */
  showSavings?: boolean;
  /** Friend-mode only: transaction id forwarded from a push notification's
   *  `?focus=<id>` param. When set, the panel scrolls the matching row into
   *  view on mount and plays a brief pulse so the viewer can locate the
   *  transaction the notification was announcing. */
  focusTxId?: string | null;
};

export function CalendarDayPanel({
  ym,
  initialDay,
  cycleStart,
  cycleEnd,
  cycleMode,
  cycleLabel,
  transactions,
  categories,
  groups,
  cycleBudget,
  isOwn,
  ownerUserId,
  lastEmojiByTx,
  lastCommentByTx,
  lastCommentMessageIdByTx,
  incomingCommentByTx,
  incomingCommentMessageIdByTx,
  incomingCommentSenderIdByTx,
  incomingCommentSenderNameByTx,
  incomingCommentUnreadByTx,
  fixedExpensesByDay,
  undatedFixedExpenses,
  savingsByDay,
  showSavings = false,
  focusTxId,
}: CalendarDayPanelProps) {
  const [selectedDay, setSelectedDay] = useState(initialDay);

  // Per-cycle fixed-expense amount override editor (own mode only). cycleAnchor
  // for the override is `ym` (the displayed cycle's anchorYm).
  const [overrideTarget, setOverrideTarget] =
    useState<FixedOverrideTarget | null>(null);
  const overrideOpen = overrideTarget !== null;

  // Undated fixed expenses (no payment_day) — scheduled in place from the
  // calendar. Tapping the nudge opens the schedule sheet directly when there's
  // exactly one; otherwise it toggles an inline list whose rows open the sheet.
  const undatedItems = useMemo(
    () => undatedFixedExpenses ?? [],
    [undatedFixedExpenses],
  );
  const [scheduleTarget, setScheduleTarget] =
    useState<UndatedFixedTarget | null>(null);
  const scheduleOpen = scheduleTarget !== null;
  const [undatedListOpen, setUndatedListOpen] = useState(false);

  const openSchedule = useCallback((item: CalendarFixedExpenseItem) => {
    setScheduleTarget({
      fixedExpenseId: item.id,
      name: item.name,
      planName: item.plan_name,
      baseAmount: item.baseAmount,
    });
  }, []);

  // Friend-mode interaction state — exclusive (only one row open at a time).
  // The parent owns the draft so we can decide whether outside-click should
  // close immediately or open the "discard draft" confirm without resorting
  // to effect-driven setState (banned by react-hooks/set-state-in-effect).
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<InteractionMode | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  const hasDraft = commentDraft.trim().length > 0;

  const commitClose = useCallback(() => {
    setActiveRowId(null);
    setActiveMode(null);
    setCommentDraft("");
    setConfirmDiscardOpen(false);
  }, []);

  const requestClose = useCallback(() => {
    if (activeMode === "comment" && hasDraft) {
      setConfirmDiscardOpen(true);
      return;
    }
    commitClose();
  }, [activeMode, hasDraft, commitClose]);

  const handleSelectDay = useCallback(
    (day: string) => {
      setSelectedDay(day);
      // Day change unmounts the active row — collapse state inline so we
      // never call setState from inside a useEffect.
      setActiveRowId(null);
      setActiveMode(null);
      setCommentDraft("");
      setConfirmDiscardOpen(false);
    },
    [],
  );

  const handleSelectMode = useCallback(
    (rowId: string, mode: InteractionMode) => {
      if (activeRowId === rowId) {
        if (activeMode === mode) {
          // Same icon re-tap — toggle close (with draft confirm).
          requestClose();
          return;
        }
        // Different icon on the same row — switch mode silently. Discard any
        // in-progress draft because we're leaving the comment textarea.
        setActiveMode(mode);
        setCommentDraft("");
        return;
      }
      // Different row — replace state. We do not warn about losing the
      // previous row's draft because the user explicitly tapped a new row,
      // which is its own intent signal.
      setActiveRowId(rowId);
      setActiveMode(mode);
      setCommentDraft("");
    },
    [activeRowId, activeMode, requestClose],
  );

  // Outside-click closes the active panel. Listener is attached only while a
  // row is open. setState happens inside the event handler (not the effect
  // body), so this satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    if (activeRowId === null) return;
    function handlePointerDown(event: PointerEvent) {
      const container = listContainerRef.current;
      if (!container) return;
      if (event.target instanceof Node && container.contains(event.target)) {
        return;
      }
      requestClose();
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [activeRowId, requestClose]);

  // Grid cell amount = variable spending + fixed expenses firing that day
  // (B-full). The cell number therefore matches the day-panel header total, and
  // the cycle's daily cells sum to totalSpent (변동 + 고정). The classification
  // baseline (cycleBudget) is the full inflow pool — not income − fixed — so the
  // fixed amount isn't subtracted twice. Friend mode passes no
  // fixedExpensesByDay, so this stays variable-only there.
  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const tx of transactions) {
      const day = toISODate(new Date(tx.spent_at));
      totals[day] = (totals[day] ?? 0) + Number(tx.amount);
    }
    for (const [iso, items] of Object.entries(fixedExpensesByDay ?? {})) {
      const fixedSum = items.reduce((sum, it) => sum + (it.amount ?? 0), 0);
      if (fixedSum !== 0) totals[iso] = (totals[iso] ?? 0) + fixedSum;
    }
    return totals;
  }, [transactions, fixedExpensesByDay]);

  const dayRows: TransactionListRow[] = useMemo(
    () =>
      transactions
        .filter((tx) => toISODate(new Date(tx.spent_at)) === selectedDay)
        .map((tx) => ({
          id: tx.id,
          amount: tx.amount,
          category_id: tx.category_id,
          category_name: tx.category_name,
          category_icon: tx.category_icon,
          category_color: tx.category_color,
          spent_at: tx.spent_at,
          memo: tx.memo,
          payment_method: tx.payment_method,
          installment_id: tx.installment_id,
          installment_seq: tx.installment_seq,
          installment_count: tx.installment_count,
          visibility: tx.visibility,
          visible_group_ids: tx.visible_group_ids,
        })),
    [transactions, selectedDay],
  );

  const txDayTotal = dayRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const label = formatKoreanLongDate(selectedDay);

  // Push-notification deep link: scroll the focused transaction row into view
  // and play a brief pulse so the viewer can spot it. Runs once per distinct
  // focusTxId per mount. The Edge function already encodes the tx's day into
  // the URL's `?day=` param, so by the time we render the row should be on
  // the currently selected day. If it isn't (tx was deleted, hidden by
  // privacy, or the day fell outside the resolved cycle), we toast — silent
  // failure would strand the viewer on the dashboard with no signal as to
  // why the notification didn't land anywhere specific.
  useEffect(() => {
    if (!focusTxId) return;

    // Defer the DOM lookup to the next frame so any in-progress commit has
    // landed before we query for the row.
    const raf = requestAnimationFrame(() => {
      const container = listContainerRef.current;
      const node = container?.querySelector<HTMLLIElement>(
        `li[data-tx-id="${focusTxId}"]`,
      );
      if (!node) {
        toast.error("해당 소비내역을 찾을 수 없어요");
        return;
      }
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.classList.add("focus-pulse");
      // Match the keyframes duration (2.4s) so the class is gone before any
      // later focus could try to re-apply it.
      window.setTimeout(() => node.classList.remove("focus-pulse"), 2500);
    });

    return () => cancelAnimationFrame(raf);
  }, [focusTxId]);

  const fixedExpensesForDay = fixedExpensesByDay?.[selectedDay] ?? [];
  // Day total = fixed expenses firing this day + variable spending. Summed so
  // every day's total reconciles to the headline totalSpent (fixed + 변동).
  const fixedDayTotal = fixedExpensesForDay.reduce(
    (sum, it) => sum + (it.amount ?? 0),
    0,
  );
  const dayTotal = txDayTotal + fixedDayTotal;
  // Set of every day in the cycle that has at least one scheduled fixed
  // expense. Used to render a small dot under those day cells.
  const fixedExpenseDays = useMemo(() => {
    const set = new Set<string>();
    if (!fixedExpensesByDay) return set;
    for (const [iso, list] of Object.entries(fixedExpensesByDay)) {
      if (list.length > 0) set.add(iso);
    }
    return set;
  }, [fixedExpensesByDay]);

  // Savings deposits firing on the selected day + the set of all deposit days.
  // Deliberately NOT folded into dailyTotals / dayTotal / classification —
  // savings is not spending, so a deposit day must never read as overspending
  // (§12.6, §12.10). Drives a green marker + a 「모으기」 day-panel row only.
  // Code-gated on `showSavings` (own mode, or a friend granted show_savings_items)
  // — not just data-gated — so a caller can't leak savings by passing data alone.
  // Savings is private (§12.10).
  const savingsForDay = showSavings ? (savingsByDay?.[selectedDay] ?? []) : [];
  const savingsDays = useMemo(() => {
    const set = new Set<string>();
    if (!showSavings || !savingsByDay) return set;
    for (const [iso, list] of Object.entries(savingsByDay)) {
      if (list.length > 0) set.add(iso);
    }
    return set;
  }, [showSavings, savingsByDay]);

  return (
    <>
      <div className="mt-3 space-y-1.5 rounded-3xl border border-black/[0.08] bg-card p-3 dark:border-white/[0.10]">
        <MonthSwitcher ym={ym} cycleLabel={cycleLabel} />
        <SpendingMonthGrid
          ym={ym}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
          cycleMode={cycleMode}
          selectedDay={selectedDay}
          dailyTotals={dailyTotals}
          cycleBudget={cycleBudget}
          fixedExpenseDays={fixedExpenseDays}
          savingsDays={savingsDays}
          onSelectDay={handleSelectDay}
        />
      </div>

      {isOwn && undatedItems.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setUndatedListOpen((prev) => !prev)}
            aria-expanded={undatedListOpen}
            className="flex w-full items-center gap-2 rounded-2xl border border-[#ffe3b3] bg-[#fff8ec] px-4 py-3 text-left text-[13px] text-[#8a6400] transition-colors active:bg-[#fdeecb]"
          >
            <AlertCircle aria-hidden className="size-4 shrink-0 text-[#e08a00]" />
            <span className="flex-1">
              날짜 미정 고정지출{" "}
              <span className="font-bold text-[#b06f00]">
                {undatedItems.length}개
              </span>{" "}
              — 날짜를 정하면 여기서 이번 달 금액을 조정할 수 있어요.
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                "size-4 shrink-0 transition-transform duration-200",
                undatedListOpen && "rotate-180",
              )}
            />
          </button>
          {undatedListOpen ? (
            <Card className="mt-2 rounded-3xl border-black/[0.08] bg-card py-2 shadow-none dark:border-white/[0.10]">
              <CardContent className="p-2">
                <ul className="space-y-0.5">
                  {undatedItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openSchedule(item)}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors active:bg-muted"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium leading-tight">
                            {item.name}
                          </p>
                          {item.plan_name ? (
                            <p className="mt-0.5 truncate text-[12px] text-muted-foreground leading-tight">
                              {item.plan_name}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[13px] font-medium text-muted-foreground">
                          날짜 미정
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <section className="mt-6 space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[15px] font-semibold tracking-[-0.015em]">
            {label}
          </h2>
          {dayTotal > 0 ? (
            <span className="text-[13px] font-semibold tabular-nums text-muted-foreground">
              {formatKRW(dayTotal)}
            </span>
          ) : null}
        </div>

        <Card className="rounded-3xl border-black/[0.08] bg-card py-2 shadow-none dark:border-white/[0.10]">
          <CardContent className="p-2" ref={listContainerRef}>
            {dayRows.length === 0 &&
            fixedExpensesForDay.length === 0 &&
            savingsForDay.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                이 날 기록된 소비가 없어요.
              </p>
            ) : (
              <ul className="[&>li+li]:relative [&>li+li]:mt-2 [&>li+li]:pt-2 [&>li+li]:before:absolute [&>li+li]:before:inset-x-6 [&>li+li]:before:top-0 [&>li+li]:before:border-t [&>li+li]:before:border-dashed [&>li+li]:before:border-border [&>li+li]:before:content-['']">
                {/* Fixed expenses firing this day, pinned above variable
                    spending. Same icon-circle row as a transaction, tagged
                    「고정」; tap (own mode) opens the per-cycle override sheet. */}
                {fixedExpensesForDay.map((item) => {
                  const amountLabel =
                    item.amount == null
                      ? "금액 미입력"
                      : formatKRW(item.amount);
                  const inner = (
                    <div className="flex w-full items-center gap-3">
                      {/* 소비(대시보드)에선 모든 고정지출을 직접추가(manual) 아이콘
                          으로 통일 — 카탈로그 카테고리별 아이콘 대신 중립 「repeat」
                          하나로. category={null}이 NEUTRAL 비주얼을 강제한다. */}
                      <FixedCategoryBadge category={null} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-[15px] font-medium leading-tight">
                          <span className="truncate">{item.name}</span>
                          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            고정
                          </span>
                          {item.isOverridden ? (
                            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              이번 달
                            </span>
                          ) : null}
                        </p>
                        {item.plan_name ? (
                          <p className="mt-0.5 truncate text-[12px] text-muted-foreground leading-tight">
                            {item.plan_name}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-[15px] font-semibold tabular-nums",
                          item.amount == null && "text-muted-foreground/70",
                        )}
                      >
                        {amountLabel}
                      </span>
                    </div>
                  );
                  return (
                    <li key={`fx-${item.id}`}>
                      {isOwn ? (
                        <button
                          type="button"
                          onClick={() =>
                            setOverrideTarget({
                              fixedExpenseId: item.id,
                              name: item.name,
                              planName: item.plan_name,
                              baseAmount: item.baseAmount,
                              currentAmount: item.amount,
                              isOverridden: item.isOverridden,
                            })
                          }
                          className="block w-full rounded-2xl px-3 py-2 text-left transition-colors hover:bg-muted active:bg-muted"
                        >
                          {inner}
                        </button>
                      ) : (
                        <div className="block w-full rounded-2xl px-3 py-2">
                          {inner}
                        </div>
                      )}
                    </li>
                  );
                })}
                {/* 저축 적립 — 「모으기」 뱃지(녹색), 고정과 변동 사이. 비-인터랙티브
                    (편집은 /savings). 그날 합계(dayTotal)·셀 색칠엔 포함하지 않는다
                    (저축 ≠ 소비, §12.6). */}
                {savingsForDay.map((item) => {
                  const amountLabel =
                    item.amount == null ? "금액 미입력" : formatKRW(item.amount);
                  return (
                    <li key={`sv-${item.id}`}>
                      <div className="flex w-full items-center gap-3 rounded-2xl px-3 py-2">
                        <span
                          aria-hidden
                          className="flex size-10 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: "#1c8c4d26", color: "#1c8c4d" }}
                        >
                          <PiggyBank className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-[15px] font-medium leading-tight">
                            <span className="truncate">{item.name}</span>
                            <span className="shrink-0 rounded-full bg-[#e8f7ee] px-1.5 py-0.5 text-[10px] font-medium text-[#1c8c4d]">
                              모으기
                            </span>
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-[15px] font-semibold tabular-nums",
                            item.amount == null && "text-muted-foreground/70",
                          )}
                        >
                          {amountLabel}
                        </span>
                      </div>
                    </li>
                  );
                })}
                {dayRows.map((transaction) => (
                  <li key={transaction.id} data-tx-id={transaction.id}>
                    <TransactionItem
                      transaction={transaction}
                      categories={categories}
                      groups={groups ?? []}
                      isOwn={isOwn}
                      ownerUserId={ownerUserId}
                      incomingComment={
                        incomingCommentByTx?.[transaction.id] ?? null
                      }
                      incomingCommentMessageId={
                        incomingCommentMessageIdByTx?.[transaction.id] ?? null
                      }
                      incomingCommentSenderId={
                        incomingCommentSenderIdByTx?.[transaction.id] ?? null
                      }
                      incomingCommentSenderName={
                        incomingCommentSenderNameByTx?.[transaction.id] ?? null
                      }
                      incomingCommentUnread={
                        incomingCommentUnreadByTx?.[transaction.id] ?? false
                      }
                      lastEmoji={lastEmojiByTx?.[transaction.id] ?? null}
                      lastComment={lastCommentByTx?.[transaction.id] ?? null}
                      lastCommentMessageId={
                        lastCommentMessageIdByTx?.[transaction.id] ?? null
                      }
                      isActive={activeRowId === transaction.id}
                      activeMode={
                        activeRowId === transaction.id ? activeMode : null
                      }
                      commentDraft={
                        activeRowId === transaction.id ? commentDraft : ""
                      }
                      onCommentDraftChange={setCommentDraft}
                      onSelectMode={handleSelectMode}
                      onCommitClose={commitClose}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {isOwn ? (
        <AddTransactionButton
          categories={categories}
          groups={groups ?? []}
          defaultDate={selectedDay}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
        />
      ) : null}

      <AlertDialog
        open={confirmDiscardOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmDiscardOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작성 중인 댓글을 지울까요?</AlertDialogTitle>
            <AlertDialogDescription>
              지우면 입력한 내용은 사라져요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDiscardOpen(false)}>
              계속 작성
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                commitClose();
              }}
              className={cn(
                buttonVariants({ variant: "destructive" }),
                "h-10 rounded-full px-4 text-[14px] font-semibold",
              )}
            >
              지우기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isOwn ? (
        <FixedOverrideDialog
          open={overrideOpen}
          onOpenChange={(open) => {
            if (!open) setOverrideTarget(null);
          }}
          cycleAnchor={ym}
          target={overrideTarget}
        />
      ) : null}

      {isOwn ? (
        <UndatedFixedDialog
          open={scheduleOpen}
          onOpenChange={(open) => {
            if (!open) setScheduleTarget(null);
          }}
          cycleAnchor={ym}
          target={scheduleTarget}
          // Prefill 결제일 with the selected calendar day's day-of-month
          // (selectedDay is "YYYY-MM-DD"), so scheduling lands on the tapped day
          // without reopening the sheet to check the date.
          defaultPaymentDay={Number(selectedDay.slice(8, 10))}
        />
      ) : null}
    </>
  );
}
