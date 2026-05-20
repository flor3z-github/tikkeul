"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export type InteractionMode = "emoji" | "comment";

export type CalendarFixedExpenseItem = {
  id: string;
  name: string;
  plan_name: string | null;
  amount: number;
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
  availableBudget: number;
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
  /** Own-mode only: fixed expenses scheduled to fire on each YYYY-MM-DD in
   *  the visible cycle. Drives the calendar marker + the per-day section. */
  fixedExpensesByDay?: Record<string, CalendarFixedExpenseItem[]>;
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
  availableBudget,
  isOwn,
  ownerUserId,
  lastEmojiByTx,
  lastCommentByTx,
  lastCommentMessageIdByTx,
  fixedExpensesByDay,
  focusTxId,
}: CalendarDayPanelProps) {
  const [selectedDay, setSelectedDay] = useState(initialDay);

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

  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const tx of transactions) {
      const day = toISODate(new Date(tx.spent_at));
      totals[day] = (totals[day] ?? 0) + Number(tx.amount);
    }
    return totals;
  }, [transactions]);

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
          visibility: tx.visibility,
          visible_group_ids: tx.visible_group_ids,
        })),
    [transactions, selectedDay],
  );

  const dayTotal = dayRows.reduce((sum, row) => sum + Number(row.amount), 0);
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
          availableBudget={availableBudget}
          fixedExpenseDays={fixedExpenseDays}
          onSelectDay={handleSelectDay}
        />
      </div>

      {fixedExpensesForDay.length > 0 ? (
        <section className="mt-6 space-y-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[15px] font-semibold tracking-[-0.015em]">
              이 날 빠지는 고정지출
            </h2>
            <span className="text-[13px] font-semibold tabular-nums text-muted-foreground">
              {formatKRW(
                fixedExpensesForDay.reduce((sum, it) => sum + it.amount, 0),
              )}
            </span>
          </div>
          <Card className="rounded-3xl border-black/[0.08] bg-card py-2 shadow-none dark:border-white/[0.10]">
            <CardContent className="p-2">
              <ul className="space-y-0.5">
                {fixedExpensesForDay.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
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
                    <span className="shrink-0 text-[15px] font-semibold tabular-nums text-muted-foreground">
                      {formatKRW(item.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
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
            {dayRows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                이 날 기록된 소비가 없어요.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {dayRows.map((transaction) => (
                  <li key={transaction.id} data-tx-id={transaction.id}>
                    <TransactionItem
                      transaction={transaction}
                      categories={categories}
                      groups={groups ?? []}
                      isOwn={isOwn}
                      ownerUserId={ownerUserId}
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
    </>
  );
}
