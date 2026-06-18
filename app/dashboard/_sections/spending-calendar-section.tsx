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
import { depositsOnDate } from "@/lib/utils/savings";
import type {
  CalendarFixedExpenseItem,
  CalendarSavingsItem,
} from "@/components/dashboard/calendar-day-panel";
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
  /**
   * Own-mode effective fixed expenses for the displayed cycle, prefetched by
   * the page via get_fixed_effective_items (amount = override ?? base). Used to
   * render per-day markers + the tap-to-override day-panel rows. In friend mode
   * the section fetches the friend's effective items itself (gated by
   * `showFixedItems`); this prop is ignored there.
   */
  ownFixedEffectiveItems?: Array<{
    id: string;
    name: string;
    plan_name: string | null;
    amount: number | null;
    base_amount: number | null;
    category: string | null;
    payment_day: number | null;
    is_overridden: boolean;
  }>;
  /**
   * Friend-mode flag: when true the owner granted the fixed-items perm, so we
   * fold the friend's fixed expenses into the calendar (same get_fixed_effective_items
   * RPC, perm re-checked server-side; a friend gets base_amount = null /
   * is_overridden = false). Undated (payment_day = null) friend fixed expenses
   * have no calendar day and are intentionally dropped in friend mode (no
   * scheduling nudge for a friend). Ignored in own mode.
   */
  showFixedItems?: boolean;
  /**
   * Friend-mode flag: owner granted show_savings_items (and show_spending_items
   * — the RPC ANDs both). When true the friend's savings deposits are fetched
   * via get_friend_savings_items (column-controlled — no opening_balance/goal
   * leak) and rendered as green calendar markers, same non-counted treatment as
   * own mode. Ignored in own mode (own savings read directly). */
  showSavingsItems?: boolean;
  /**
   * Own-mode per-cycle extra income prefetched by the page. Folded into
   * `cycleBudget` (income + 추가수입) so calendar day-classification
   * (normal/warning/danger) uses the full inflow pool as its baseline. Ignored
   * in friend mode.
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
  ownFixedEffectiveItems,
  ownExtraIncome,
  showSpendingItems = true,
  showFixedItems = false,
  showSavingsItems = false,
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
  // base). Friend mode fetches the same RPC below (gated by `showFixedItems`)
  // so the friend's fixed expenses fold into the calendar (B-full) — the RPC
  // re-checks show_fixed_items and returns base_amount/is_overridden nulled, so
  // no override signal leaks (DESIGN.md §12.6).
  const supabase = await createClient();
  const [
    monthlyResult,
    categoriesResult,
    viewerInteractions,
    ownGroupsRes,
    friendFixedRes,
    savingsRes,
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
    // Friend-mode fixed expenses for the displayed cycle (B-full: folded into
    // the calendar). Same RPC the FriendFixedSection list used; it re-checks the
    // show_fixed_items perm server-side and returns base_amount = null /
    // is_overridden = false for a friend. Own mode uses the page-prefetched
    // ownFixedEffectiveItems instead, so this stays empty.
    !isOwn && showFixedItems
      ? supabase.rpc("get_fixed_effective_items", {
          target: userId,
          cycle_anchor: ym,
        })
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            subscription_plan_id: string | null;
            name: string;
            plan_name: string | null;
            amount: number | null;
            base_amount: number | null;
            category: string | null;
            payment_day: number | null;
            is_overridden: boolean;
          }>,
        }),
    // Savings deposits for the displayed cycle — green calendar markers only
    // (NOT folded into any total; §12.6). Own mode reads savings_plans directly
    // (RLS own-only). Friend mode with show_savings_items reads via the
    // get_friend_savings_items RPC (column-controlled — only the marker columns,
    // no opening_balance/goal; RPC ANDs show_spending_items as a backstop). All
    // other cases stub empty.
    isOwn
      ? supabase
          .from("savings_plans")
          .select("id, name, amount, payment_day, start_date, maturity_date")
          .eq("user_id", userId)
          .eq("is_active", true)
      : showSavingsItems
        ? supabase.rpc("get_friend_savings_items", { target: userId })
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              name: string;
              amount: number | null;
              payment_day: number | null;
              start_date: string;
              maturity_date: string | null;
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
  const extraIncome = isOwn ? (ownExtraIncome ?? 0) : 0;
  // Daily-classification baseline for the grid (B-full): the cycle's full
  // inflow pool (income + 추가수입), NOT income − fixed. Fixed expenses are
  // charged on the day they fire (folded into each day's cell amount in
  // CalendarDayPanel), so subtracting fixed here too would double-count it.
  // Friend mode → 0 (income hidden) → classifyDailyAmount returns "normal".
  const cycleBudget = monthlyIncome + extraIncome;

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
  // Source = own-mode page-prefetched items, or the friend RPC result (same
  // shape; base_amount/is_overridden already nulled server-side for a friend).
  const fixedEffectiveSource = isOwn
    ? (ownFixedEffectiveItems ?? [])
    : (friendFixedRes.data ?? []);
  const fixedExpenseItems: CalendarFixedExpenseItem[] = fixedEffectiveSource.map(
    (row) => ({
      id: row.id,
      name: row.name,
      plan_name: row.plan_name,
      amount: row.amount == null ? null : Number(row.amount),
      baseAmount: row.base_amount == null ? null : Number(row.base_amount),
      category: row.category,
      isOverridden: row.is_overridden,
      payment_day: row.payment_day,
    }),
  );
  // expandFixedExpensesByDay self-filters items without a payment_day and
  // dedupes a long cycle's double-match to the first matching day.
  const fixedExpensesByDay = expandFixedExpensesByDay(
    cycleStart,
    cycleEnd,
    fixedExpenseItems,
  );
  // Active fixed expenses with no payment_day have no calendar day, so the
  // per-day override edit can't reach them — surface a nudge in the day panel.
  // Own mode only: a friend's undated fixed expenses are intentionally dropped
  // (no calendar day, no scheduling affordance for a friend).
  const undatedFixedExpenses = isOwn
    ? fixedExpenseItems.filter((it) => it.payment_day == null)
    : [];

  // Savings deposits expanded to per-day (own mode only; friend mode read above
  // is stubbed empty). payment_day=null rows self-drop in the expander. These
  // drive a green calendar marker + a 「모으기」 day-panel row, NEVER a total.
  //
  // Carry start_date/maturity_date through the expansion so we can bound each
  // deposit to the plan's life via `depositsOnDate` (exact-date, TZ-safe). The
  // expander places a deposit on its payment_day within the cycle; we then drop
  // any landing before the plan started or after it matured, so a cycle outside
  // the plan's life shows no phantom marker (a plan started on the 18th with
  // payment_day=1 first deposits the next month's 1st).
  // own (table row) and friend (RPC row) shapes share these columns; normalize
  // to one type so the union .map type-checks.
  const savingsRows = (savingsRes.data ?? []) as Array<{
    id: string;
    name: string;
    amount: number | null;
    payment_day: number | null;
    start_date: string;
    maturity_date: string | null;
  }>;
  const savingsItems = savingsRows.map((row) => ({
    id: row.id,
    name: row.name,
    amount: row.amount == null ? null : Number(row.amount),
    payment_day: row.payment_day,
    start_date: row.start_date,
    maturity_date: row.maturity_date,
  }));
  const savingsByDayRaw = expandFixedExpensesByDay(
    cycleStart,
    cycleEnd,
    savingsItems,
  );
  const savingsByDay: Record<string, CalendarSavingsItem[]> = {};
  for (const [iso, items] of Object.entries(savingsByDayRaw)) {
    const kept = items.filter((it) => depositsOnDate(it, iso));
    if (kept.length > 0) {
      savingsByDay[iso] = kept.map((it) => ({
        id: it.id,
        name: it.name,
        amount: it.amount,
        payment_day: it.payment_day,
      }));
    }
  }

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
      cycleBudget={cycleBudget}
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
      savingsByDay={savingsByDay}
      showSavings={isOwn || showSavingsItems}
      focusTxId={focusTxId ?? null}
    />
  );
}
