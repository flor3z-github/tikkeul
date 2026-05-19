import { CalendarDayPanel } from "@/components/dashboard/calendar-day-panel";
import { getCategories } from "@/lib/queries/categories";
import {
  getViewerInteractionsByTransaction,
  type ViewerInteractionsByTransaction,
} from "@/lib/queries/interactions";
import { getMonthlyTransactions } from "@/lib/queries/transactions";
import { createClient } from "@/lib/supabase/server";
import type { CycleMode } from "@/lib/utils/calendar";
import { expandFixedExpensesByDay } from "@/lib/utils/payment-day";
import type { CalendarFixedExpenseItem } from "@/components/dashboard/calendar-day-panel";

type SpendingCalendarSectionProps = {
  /** Viewer id resolved by the page from JWT claims — no auth call here. */
  viewerId: string;
  ym: string;
  initialDay: string;
  startIso: string;
  endIso: string;
  cycleStart: Date;
  cycleEnd: Date;
  cycleMode: CycleMode;
  cycleLabel: string;
  targetUserId?: string;
  /** Own-mode user_settings prefetched by the page. Ignored in friend mode. */
  ownSettings?: { hasSettings: boolean; monthlyIncome: number };
  /** Own-mode fixed-expense total prefetched by the page. Ignored in friend mode. */
  ownFixedExpense?: number;
  /**
   * Friend-mode flag: render only when the owner has granted the spending
   * items perm. Ignored in own mode. Defaults to true for backward compat.
   */
  showSpendingItems?: boolean;
  /** Push-notification deep link target. Forwarded straight to the day
   *  panel which handles scroll-and-pulse on mount. */
  focusTxId?: string | null;
};

export async function SpendingCalendarSection({
  viewerId,
  ym,
  initialDay,
  startIso,
  endIso,
  cycleStart,
  cycleEnd,
  cycleMode,
  cycleLabel,
  targetUserId,
  ownSettings,
  ownFixedExpense,
  showSpendingItems = true,
  focusTxId,
}: SpendingCalendarSectionProps) {
  const userId = targetUserId ?? viewerId;
  const isOwn = userId === viewerId;

  // Friend mode without items perm: hide entire calendar + day list block.
  if (!isOwn && !showSpendingItems) return null;

  // Categories are shared seeds + the viewer's own customs; pass viewerId so
  // we still surface the viewer's category list (which is what they can pick
  // when adding their own transactions). For friend-view mode this is unused
  // because the calendar is read-only, but the prop is still required.
  //
  // user_settings + fixed_expenses are prefetched by the page (own mode only).
  // monthly transactions go through React `cache()` so this overlaps with the
  // summary section's call.
  // Friend mode: also resolve the viewer's most recent emoji reaction and
  // most recent text comment per friend transaction, in a single batched
  // read. Drives the heart icon and the read-only "last comment" trace next
  // to the message icon. Own mode skips this entirely (no DM thread, no
  // interaction state to surface).
  // Own-mode-only: pull active fixed_expenses with a payment_day so we can
  // surface "scheduled to come out on day X" markers on the calendar. Friend
  // mode is intentionally excluded for now — privacy of friend's payment
  // schedule has not been spec'd in DESIGN.md.
  const supabase = await createClient();
  const [
    monthlyResult,
    categoriesResult,
    viewerInteractions,
    fixedExpensesRes,
  ] = await Promise.all([
    getMonthlyTransactions(userId, startIso, endIso),
    getCategories(viewerId),
    !isOwn
      ? getViewerInteractionsByTransaction(viewerId, userId)
      : Promise.resolve(
          new Map() as ViewerInteractionsByTransaction,
        ),
    isOwn
      ? supabase
          .from("fixed_expenses")
          .select("id, name, plan_name, amount, payment_day")
          .eq("user_id", userId)
          .eq("is_active", true)
          .not("payment_day", "is", null)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            name: string;
            plan_name: string | null;
            amount: number;
            payment_day: number | null;
          }>,
        }),
  ]);

  if (!monthlyResult.ok) {
    return (
      <div className="mt-3 space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">달력을 불러오지 못했어요</p>
        <p className="break-all text-xs opacity-80">{monthlyResult.error}</p>
      </div>
    );
  }

  if (!categoriesResult.ok) {
    return (
      <div className="mt-3 space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">카테고리를 불러오지 못했어요</p>
        <p className="break-all text-xs opacity-80">{categoriesResult.error}</p>
      </div>
    );
  }

  const monthlyIncome = isOwn ? (ownSettings?.monthlyIncome ?? 0) : 0;
  const fixedExpense = isOwn ? (ownFixedExpense ?? 0) : 0;
  const availableBudget = Math.max(0, monthlyIncome - fixedExpense);

  // Map isn't directly preserved across the Server → Client boundary in all
  // Next build modes, so flatten to plain objects keyed by txId.
  const lastEmojiByTx: Record<string, string> = {};
  const lastCommentByTx: Record<string, string> = {};
  const lastCommentMessageIdByTx: Record<string, string> = {};
  for (const [txId, entry] of viewerInteractions) {
    if (entry.lastEmoji) lastEmojiByTx[txId] = entry.lastEmoji;
    if (entry.lastComment) lastCommentByTx[txId] = entry.lastComment;
    if (entry.lastCommentMessageId)
      lastCommentMessageIdByTx[txId] = entry.lastCommentMessageId;
  }

  // Resolve each fixed expense's payment_day → concrete dates within the
  // visible cycle. Income_day cycles span two months, so payment_day=20 may
  // fire twice (e.g. for a cycle 5/15–6/14, day 20 fires on 5/20 only because
  // 6/20 falls outside; but 5/20 is captured by walking every cycle day).
  const fixedExpenseItems: CalendarFixedExpenseItem[] = (
    fixedExpensesRes.data ?? []
  ).map((row) => ({
    id: row.id,
    name: row.name,
    plan_name: row.plan_name,
    amount: Number(row.amount),
    payment_day: row.payment_day,
  }));
  const fixedExpensesByDay = expandFixedExpensesByDay(
    cycleStart,
    cycleEnd,
    fixedExpenseItems,
  );

  return (
    <CalendarDayPanel
      key={`${ym}-${cycleMode}`}
      ym={ym}
      initialDay={initialDay}
      cycleStart={cycleStart}
      cycleEnd={cycleEnd}
      cycleMode={cycleMode}
      cycleLabel={cycleLabel}
      transactions={monthlyResult.transactions}
      categories={categoriesResult.categories}
      availableBudget={availableBudget}
      isOwn={isOwn}
      ownerUserId={userId}
      lastEmojiByTx={lastEmojiByTx}
      lastCommentByTx={lastCommentByTx}
      lastCommentMessageIdByTx={lastCommentMessageIdByTx}
      fixedExpensesByDay={fixedExpensesByDay}
      focusTxId={focusTxId ?? null}
    />
  );
}
