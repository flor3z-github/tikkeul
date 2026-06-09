import { CalendarDayPanel } from "@/components/dashboard/calendar-day-panel";
import { getCategories } from "@/lib/queries/categories";
import {
  getIncomingInteractionsByTransaction,
  getViewerInteractionsByTransaction,
  type IncomingInteractionsByTransaction,
  type ViewerInteractionsByTransaction,
} from "@/lib/queries/interactions";
import { getMonthlyTransactions } from "@/lib/queries/transactions";
import { createClient } from "@/lib/supabase/server";
import type { CycleMode } from "@/lib/utils/calendar";
import { expandFixedExpensesByDay } from "@/lib/utils/payment-day";
import type { CalendarFixedExpenseItem } from "@/components/dashboard/calendar-day-panel";
import type { TransactionFormGroup } from "@/components/transactions/transaction-form-dialog";

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
   * Own-mode effective fixed expenses for the displayed cycle, prefetched by
   * the page via get_fixed_effective_items (amount = override ?? base). Used to
   * render per-day markers + the tap-to-override day-panel rows. Ignored in
   * friend mode (friend calendar shows no fixed markers).
   */
  ownFixedEffectiveItems?: Array<{
    id: string;
    name: string;
    plan_name: string | null;
    amount: number | null;
    base_amount: number | null;
    payment_day: number | null;
    is_overridden: boolean;
  }>;
  /**
   * Own-mode per-cycle extra income prefetched by the page. Folded into
   * `availableBudget` so calendar day-classification (normal/warning/danger)
   * uses the effective cycle budget. Ignored in friend mode.
   */
  ownExtraIncome?: number;
  /**
   * Friend-mode flag: render only when the owner has granted the spending
   * items perm. Ignored in own mode. Defaults to true for backward compat.
   */
  showSpendingItems?: boolean;
  /**
   * Own-mode flag: true when the viewer has at least one friend. Gates the
   * incoming-comment fetch — with zero friends no DM thread can exist, so we
   * skip the extra round-trip entirely and keep the dashboard hot path lean
   * (DESIGN.md §3). Ignored in friend mode.
   */
  hasFriends?: boolean;
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
  ownFixedEffectiveItems,
  ownExtraIncome,
  showSpendingItems = true,
  hasFriends = false,
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
  // Own-mode fixed-expense markers come from the page-prefetched
  // `ownFixedEffectiveItems` (get_fixed_effective_items: amount = override ??
  // base). Friend mode is intentionally excluded — privacy of a friend's
  // payment schedule has not been spec'd in DESIGN.md.
  const supabase = await createClient();
  const [
    monthlyResult,
    categoriesResult,
    viewerInteractions,
    ownGroupsRes,
  ] = await Promise.all([
    getMonthlyTransactions(userId, startIso, endIso),
    getCategories(viewerId),
    !isOwn
      ? getViewerInteractionsByTransaction(viewerId, userId)
      : Promise.resolve(
          new Map() as ViewerInteractionsByTransaction,
        ),
    // Own-mode only: resolve all of the viewer's friend groups (seed +
    // user-defined). The form needs the seed today and the full array in
    // step 6 (multi-group picker). Friend mode never edits.
    isOwn
      ? supabase
          .from("friend_groups")
          .select("id, name, slug, created_at")
          .eq("owner_id", viewerId)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            name: string;
            slug: string | null;
            created_at: string;
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
  const extraIncome = isOwn ? (ownExtraIncome ?? 0) : 0;
  const availableBudget = Math.max(
    0,
    monthlyIncome + extraIncome - fixedExpense,
  );

  // Own mode only: comments friends left on the owner's own transactions,
  // surfaced as a trace under each row (deep-links to the DM message). Needs
  // the resolved transaction ids, so it runs after the monthly fetch rather
  // than inside the Promise.all above (one extra round-trip, own mode only).
  // Friend mode never queries this — the viewer-direction trace above already
  // covers that surface. With zero friends there can be no DM thread, so we
  // skip the round-trip and keep the dashboard hot path lean (DESIGN.md §3).
  const incomingInteractions: IncomingInteractionsByTransaction =
    isOwn && hasFriends
      ? await getIncomingInteractionsByTransaction(
          viewerId,
          monthlyResult.transactions.map((tx) => tx.id),
        )
      : new Map();

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

  const incomingCommentByTx: Record<string, string> = {};
  const incomingCommentMessageIdByTx: Record<string, string> = {};
  const incomingCommentSenderIdByTx: Record<string, string> = {};
  const incomingCommentSenderNameByTx: Record<string, string> = {};
  const incomingCommentUnreadByTx: Record<string, boolean> = {};
  for (const [txId, entry] of incomingInteractions) {
    incomingCommentByTx[txId] = entry.lastComment;
    incomingCommentMessageIdByTx[txId] = entry.lastCommentMessageId;
    incomingCommentSenderIdByTx[txId] = entry.senderId;
    incomingCommentSenderNameByTx[txId] = entry.senderName;
    incomingCommentUnreadByTx[txId] = entry.unread;
  }

  // Resolve each fixed expense's payment_day → concrete dates within the
  // visible cycle. Income_day cycles span two months, so payment_day=20 may
  // fire twice (e.g. for a cycle 5/15–6/14, day 20 fires on 5/20 only because
  // 6/20 falls outside; but 5/20 is captured by walking every cycle day).
  const fixedExpenseItems: CalendarFixedExpenseItem[] = (
    ownFixedEffectiveItems ?? []
  ).map((row) => ({
    id: row.id,
    name: row.name,
    plan_name: row.plan_name,
    amount: row.amount == null ? null : Number(row.amount),
    baseAmount: row.base_amount == null ? null : Number(row.base_amount),
    isOverridden: row.is_overridden,
    payment_day: row.payment_day,
  }));
  // expandFixedExpensesByDay self-filters items without a payment_day and
  // dedupes a long cycle's double-match to the first matching day.
  const fixedExpensesByDay = expandFixedExpensesByDay(
    cycleStart,
    cycleEnd,
    fixedExpenseItems,
  );
  // Active fixed expenses with no payment_day have no calendar day, so the
  // per-day override edit can't reach them — surface a nudge in the day panel.
  const undatedFixedExpenses = fixedExpenseItems.filter(
    (it) => it.payment_day == null,
  );

  // Resolve member ids and nicknames for every own-mode group in one pass.
  // The form needs each group's members for the visibility selector / nested
  // preview drawer. Friend mode skips entirely — no edit affordance, no FAB.
  let groups: TransactionFormGroup[] = [];
  if (isOwn && (ownGroupsRes.data ?? []).length > 0) {
    const rawGroups = (ownGroupsRes.data ?? []).map((g) => ({
      id: g.id as string,
      name: g.name as string,
      slug: g.slug as string | null,
      created_at: g.created_at as string,
    }));
    const groupIds = rawGroups.map((g) => g.id);

    const { data: memberRows } = await supabase
      .from("friend_group_members")
      .select("group_id, member_user_id")
      .in("group_id", groupIds);

    const membersByGroup = new Map<string, string[]>();
    const allMemberIds = new Set<string>();
    for (const row of memberRows ?? []) {
      const gid = row.group_id as string;
      const mid = row.member_user_id as string;
      const list = membersByGroup.get(gid) ?? [];
      list.push(mid);
      membersByGroup.set(gid, list);
      allMemberIds.add(mid);
    }

    let nicknameById = new Map<string, string>();
    if (allMemberIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", Array.from(allMemberIds));
      nicknameById = new Map(
        (profiles ?? []).map((p) => [
          p.id as string,
          (p.display_name as string | null)?.trim() || "이름 없음",
        ]),
      );
    }

    // Sort: seed first, then created_at — matches /friends/groups so the
    // form's eventual multi-group picker (step 6) lists in the same order
    // the user sees in the management screen.
    groups = rawGroups
      .sort((a, b) => {
        const aSeed = a.slug === "close" ? 0 : 1;
        const bSeed = b.slug === "close" ? 0 : 1;
        if (aSeed !== bSeed) return aSeed - bSeed;
        return a.created_at.localeCompare(b.created_at);
      })
      .map((g) => ({
        id: g.id,
        name: g.name,
        isSeed: g.slug === "close",
        members: (membersByGroup.get(g.id) ?? []).map((mid) => ({
          id: mid,
          nickname: nicknameById.get(mid) ?? "이름 없음",
        })),
      }));
  }

  return (
    <CalendarDayPanel
      key={`${ym}-${cycleMode}-${initialDay}`}
      ym={ym}
      initialDay={initialDay}
      cycleStart={cycleStart}
      cycleEnd={cycleEnd}
      cycleMode={cycleMode}
      cycleLabel={cycleLabel}
      transactions={monthlyResult.transactions}
      categories={categoriesResult.categories}
      groups={groups}
      availableBudget={availableBudget}
      isOwn={isOwn}
      ownerUserId={userId}
      lastEmojiByTx={lastEmojiByTx}
      lastCommentByTx={lastCommentByTx}
      lastCommentMessageIdByTx={lastCommentMessageIdByTx}
      incomingCommentByTx={incomingCommentByTx}
      incomingCommentMessageIdByTx={incomingCommentMessageIdByTx}
      incomingCommentSenderIdByTx={incomingCommentSenderIdByTx}
      incomingCommentSenderNameByTx={incomingCommentSenderNameByTx}
      incomingCommentUnreadByTx={incomingCommentUnreadByTx}
      fixedExpensesByDay={fixedExpensesByDay}
      undatedFixedExpenses={undatedFixedExpenses}
      focusTxId={focusTxId ?? null}
    />
  );
}
