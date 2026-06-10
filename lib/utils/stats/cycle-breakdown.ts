import type { MonthlyTransaction } from "@/lib/queries/transactions";

/**
 * Pure aggregation for the /stats "이번 사이클 소비 구성 분해" screen (§12.9).
 *
 * TIMEZONE-AGNOSTIC: groups already-fetched rows by category/item and sums
 * amounts; it never parses or compares dates. Cycle [start, end) boundary
 * correctness (KST/UTC) and the PREVIOUS-cycle window are resolved by
 * `lib/utils/payday-cycle.ts` (getPreviousCycleB) BEFORE these functions run.
 *
 * 전월比 (previous-cycle deltas): every function optionally takes the previous
 * cycle's rows and annotates each output row with `delta = thisCycle − prevCycle`.
 * A delta is emitted only when there is a real prior value to compare against
 * (prev > 0); a brand-new category/item (absent last cycle) gets `delta: null`.
 * The CALLER additionally gates the whole comparison on the previous cycle
 * having had real transactions (see /stats page `hasPrevBaseline`) so a first-
 * ever cycle doesn't show fake deltas against standing fixed expenses.
 *
 * Asymmetry is deliberate (§12.9): variable spending is grouped by `category_id`
 * (many transactions → a few category rows); fixed expenses stay per-item.
 *
 * Total invariants so /stats matches the dashboard exactly:
 *   - variableTotal(tx) === dashboard `monthlyTotal`
 *   - fixedTotal(items) === dashboard `ownFixedExpense` (Σ amount ?? 0 over ALL
 *     items, pre-filter)
 *   - grandTotal === dashboard `totalSpent`
 */

/** Minimal structural input — only the fields the breakdown reads. */
export type VariableTxInput = Pick<
  MonthlyTransaction,
  "amount" | "category_id" | "category_name" | "category_icon" | "category_color"
>;

/** Effective fixed-expense item (override-aware) as returned by the
 *  `get_fixed_effective_items` RPC and mapped on the dashboard page. */
export type FixedEffectiveItem = {
  id: string;
  name: string;
  plan_name: string | null;
  amount: number | null;
  base_amount: number | null;
  category: string | null;
  payment_day: number | null;
  is_overridden: boolean;
};

export type VariableBreakdownRow = {
  /** null when the transaction had no category (rendered as "미분류"). */
  categoryId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  total: number;
  /** 0..100, self-normalized within the variable section (Σ ≈ 100). Raw. */
  share: number;
  /** thisCycle − prevCycle for the same category. null when this category had
   *  no spending last cycle (or no prev data supplied). */
  delta: number | null;
};

export type FixedBreakdownRow = {
  id: string;
  name: string;
  planName: string | null;
  category: string | null;
  amount: number;
  /** thisCycle − prevCycle effective for the same item. null when the item
   *  didn't exist last cycle (or no prev data supplied). Positive = costs more
   *  than last cycle (e.g. a higher bank-interest month). */
  delta: number | null;
};

/** Bucket key for transactions with no category_id. */
const UNCATEGORIZED_KEY = "__uncategorized__";
const UNCATEGORIZED_NAME = "미분류";
/** Grouping key for fixed items with no catalog category (직접 추가). */
const FIXED_NONE_KEY = "__manual__";

/** Σ of all transaction amounts. Equals the dashboard's `monthlyTotal`. */
export function variableTotal(transactions: VariableTxInput[]): number {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

/** Per-category totals keyed by category_id (null → UNCATEGORIZED_KEY). */
function categoryTotals(transactions: VariableTxInput[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    const key = tx.category_id ?? UNCATEGORIZED_KEY;
    totals.set(key, (totals.get(key) ?? 0) + tx.amount);
  }
  return totals;
}

/**
 * Group transactions by `category_id`, summing amounts. Bars/% are normalized
 * within the variable section. Rows with total ≤ 0 hidden; amount desc (name
 * tie-break). When `prevTransactions` is supplied, each row carries the change
 * vs the same category last cycle (delta null for categories new this cycle).
 */
export function aggregateVariableByCategory(
  transactions: VariableTxInput[],
  prevTransactions?: VariableTxInput[],
): VariableBreakdownRow[] {
  const groups = new Map<
    string,
    { categoryId: string | null; name: string; icon: string | null; color: string | null; total: number }
  >();

  for (const tx of transactions) {
    const key = tx.category_id ?? UNCATEGORIZED_KEY;
    const existing = groups.get(key);
    if (existing) {
      existing.total += tx.amount;
    } else {
      groups.set(key, {
        categoryId: tx.category_id,
        name: tx.category_name ?? UNCATEGORIZED_NAME,
        icon: tx.category_icon,
        color: tx.category_color,
        total: tx.amount,
      });
    }
  }

  const total = variableTotal(transactions);
  const prevTotals = prevTransactions
    ? categoryTotals(prevTransactions)
    : null;

  return [...groups.entries()]
    .filter(([, g]) => g.total > 0)
    .map(([key, g]) => {
      const prev = prevTotals?.get(key);
      return {
        categoryId: g.categoryId,
        name: g.name,
        icon: g.icon,
        color: g.color,
        total: g.total,
        share: total > 0 ? (g.total / total) * 100 : 0,
        delta: prev && prev > 0 ? g.total - prev : null,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/** Σ of effective amounts over ALL items (amount ?? 0). Matches the dashboard's
 *  `ownFixedExpense` exactly — raw items, NOT the display-filtered output. */
export function fixedTotal(items: FixedEffectiveItem[]): number {
  return items.reduce((sum, it) => sum + (it.amount ?? 0), 0);
}

/**
 * Map fixed items to display rows, GROUPED by catalog category. Group order =
 * group total desc; within a group, amount desc (§12.9 — no sub-headers, the
 * per-category icon distinguishes groups). Items with no positive effective
 * amount are dropped from the list (the total still counts them). When
 * `prevItems` is supplied, each row carries the change vs the same item's
 * effective amount last cycle (delta null for items new this cycle).
 */
export function mapFixedItems(
  items: FixedEffectiveItem[],
  prevItems?: FixedEffectiveItem[],
): FixedBreakdownRow[] {
  const prevById = new Map<string, number>();
  if (prevItems) {
    for (const it of prevItems) prevById.set(it.id, it.amount ?? 0);
  }

  const rows: FixedBreakdownRow[] = items
    .map((it) => {
      const amount = it.amount ?? 0;
      const prev = prevById.get(it.id);
      return {
        id: it.id,
        name: it.name,
        planName: it.plan_name,
        category: it.category,
        amount,
        delta: prev && prev > 0 ? amount - prev : null,
      };
    })
    .filter((r) => r.amount > 0);

  // Catalog grouping: order groups by their total (desc) so the largest cluster
  // (usually 직접 추가) leads, then sort within a group by amount (desc). The
  // group-key tie-break keeps a group's items contiguous even on equal totals.
  const groupTotals = new Map<string, number>();
  for (const r of rows) {
    const k = r.category ?? FIXED_NONE_KEY;
    groupTotals.set(k, (groupTotals.get(k) ?? 0) + r.amount);
  }

  return rows.sort((a, b) => {
    const ak = a.category ?? FIXED_NONE_KEY;
    const bk = b.category ?? FIXED_NONE_KEY;
    const byGroup = (groupTotals.get(bk) ?? 0) - (groupTotals.get(ak) ?? 0);
    if (byGroup !== 0) return byGroup;
    if (ak !== bk) return ak.localeCompare(bk);
    return b.amount - a.amount || a.name.localeCompare(b.name);
  });
}

/** variableTotal + fixedTotal. Equals the dashboard's `totalSpent`. */
export function grandTotal(
  transactions: VariableTxInput[],
  items: FixedEffectiveItem[],
): number {
  return variableTotal(transactions) + fixedTotal(items);
}
