import { CalendarDayPanel } from "@/components/dashboard/calendar-day-panel";
import { getCategories } from "@/lib/queries/categories";
import {
  getLastEmojiByTransaction,
  type LastEmojiByTransaction,
} from "@/lib/queries/interactions";
import { getMonthlyTransactions } from "@/lib/queries/transactions";
import type { CycleMode } from "@/lib/utils/calendar";

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
  // Friend mode: also resolve the viewer's last emoji-only DM-reaction per
  // friend transaction so the heart icon can render with the viewer's own
  // previous reaction. Own mode skips this entirely (no DM thread, no
  // reaction state to surface).
  const [monthlyResult, categoriesResult, lastEmojiByTx] = await Promise.all([
    getMonthlyTransactions(userId, startIso, endIso),
    getCategories(viewerId),
    !isOwn
      ? getLastEmojiByTransaction(viewerId, userId)
      : Promise.resolve(
          new Map() as LastEmojiByTransaction,
        ),
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

  // Map<txId, emoji> isn't directly serializable through a Server → Client
  // boundary (Map → not preserved by Next's RSC serialization in all build
  // modes), so flatten to a plain object.
  const lastEmojiByTxObj: Record<string, string> = {};
  for (const [txId, emoji] of lastEmojiByTx) {
    lastEmojiByTxObj[txId] = emoji;
  }

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
      lastEmojiByTx={lastEmojiByTxObj}
    />
  );
}
