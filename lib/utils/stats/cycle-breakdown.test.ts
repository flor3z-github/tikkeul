import { describe, expect, it } from "vitest";

import {
  aggregateVariableByCategory,
  fixedDelta,
  fixedTotal,
  mapFixedItems,
  sortVariableItems,
  variableTotal,
  type FixedEffectiveItem,
  type VariableBreakdownItem,
  type VariableTxInput,
} from "@/lib/utils/stats/cycle-breakdown";

// NOTE: this layer is timezone-agnostic — it groups already-fetched rows and
// sums amounts, never touching dates. Cycle [start, end) boundaries AND the
// previous-cycle window are resolved by lib/utils/payday-cycle.ts (covered in
// payday-cycle.test.ts, incl. getPreviousCycleB). So there are deliberately NO
// TZ tests below — only aggregation, grouping, and delta invariants.

let txSeq = 0;
function tx(
  category_id: string | null,
  amount: number,
  meta?: Partial<VariableTxInput>,
): VariableTxInput {
  return {
    id: meta?.id ?? `tx-${txSeq++}`,
    amount,
    category_id,
    category_name: meta?.category_name ?? (category_id ? category_id : null),
    category_icon: meta?.category_icon ?? null,
    category_color: meta?.category_color ?? null,
    spent_at: meta?.spent_at ?? "2026-06-15T00:00:00.000Z",
    memo: meta?.memo ?? null,
  };
}

function fixed(
  id: string,
  amount: number | null,
  opts?: Partial<FixedEffectiveItem>,
): FixedEffectiveItem {
  return {
    id,
    name: opts?.name ?? id,
    plan_name: opts?.plan_name ?? null,
    amount,
    base_amount: opts && "base_amount" in opts ? (opts.base_amount ?? null) : amount,
    category: opts?.category ?? null,
    payment_day: opts?.payment_day ?? null,
    is_overridden: opts?.is_overridden ?? false,
  };
}

describe("variableTotal", () => {
  it("sums all transaction amounts", () => {
    expect(variableTotal([tx("a", 100), tx("b", 250), tx("a", 50)])).toBe(400);
  });
  it("is 0 for an empty array", () => {
    expect(variableTotal([])).toBe(0);
  });
});

describe("aggregateVariableByCategory", () => {
  it("groups by category_id and sums", () => {
    const rows = aggregateVariableByCategory([
      tx("food", 100),
      tx("cafe", 30),
      tx("food", 200),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.categoryId === "food")?.total).toBe(300);
  });

  it("sorts by total desc, name tie-break", () => {
    const rows = aggregateVariableByCategory([
      tx("z", 100, { category_name: "지" }),
      tx("a", 100, { category_name: "가" }),
      tx("big", 500, { category_name: "큰" }),
    ]);
    expect(rows.map((r) => r.categoryId)).toEqual(["big", "a", "z"]);
  });

  it("self-normalizes shares to 100 within the section", () => {
    const rows = aggregateVariableByCategory([
      tx("a", 300),
      tx("b", 100),
      tx("c", 100),
    ]);
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(100, 6);
    expect(rows[0].share).toBeCloseTo(60, 6);
  });

  it("hides categories whose total is 0", () => {
    const rows = aggregateVariableByCategory([tx("a", 100), tx("b", 0)]);
    expect(rows.map((r) => r.categoryId)).toEqual(["a"]);
  });

  it("buckets null category_id under 미분류 with null categoryId", () => {
    const rows = aggregateVariableByCategory([
      tx(null, 50),
      tx(null, 70),
      tx("food", 80),
    ]);
    const uncat = rows.find((r) => r.categoryId === null);
    expect(uncat?.name).toBe("미분류");
    expect(uncat?.total).toBe(120);
  });

  it("returns [] for no transactions", () => {
    expect(aggregateVariableByCategory([])).toEqual([]);
  });

  // 전월比
  it("leaves delta null when no previous data is supplied", () => {
    const rows = aggregateVariableByCategory([tx("food", 100)]);
    expect(rows[0].delta).toBeNull();
  });

  it("computes delta vs the same category last cycle", () => {
    const cur = [tx("food", 312_000), tx("cafe", 96_000)];
    const prev = [tx("food", 282_000), tx("cafe", 96_000)];
    const rows = aggregateVariableByCategory(cur, prev);
    expect(rows.find((r) => r.categoryId === "food")?.delta).toBe(30_000);
    // unchanged category → delta 0 (the view hides it)
    expect(rows.find((r) => r.categoryId === "cafe")?.delta).toBe(0);
  });

  it("leaves delta null for a category that didn't exist last cycle", () => {
    const rows = aggregateVariableByCategory(
      [tx("new", 50_000)],
      [tx("food", 100_000)],
    );
    expect(rows.find((r) => r.categoryId === "new")?.delta).toBeNull();
  });

  // per-category drill-down items
  it("collects each category's transactions as items", () => {
    const rows = aggregateVariableByCategory([
      tx("food", 100, { id: "a" }),
      tx("cafe", 30, { id: "b" }),
      tx("food", 200, { id: "c" }),
    ]);
    const food = rows.find((r) => r.categoryId === "food");
    expect(food?.items.map((i) => i.id).sort()).toEqual(["a", "c"]);
    expect(rows.find((r) => r.categoryId === "cafe")?.items).toHaveLength(1);
  });

  it("sorts items by amount desc regardless of input order", () => {
    const rows = aggregateVariableByCategory([
      tx("food", 100, { id: "mid" }),
      tx("food", 50, { id: "small" }),
      tx("food", 200, { id: "big" }),
    ]);
    expect(rows[0].items.map((i) => i.id)).toEqual(["big", "mid", "small"]);
  });

  it("breaks an amount tie by newest first", () => {
    const rows = aggregateVariableByCategory([
      tx("food", 100, { id: "older", spent_at: "2026-06-01T00:00:00.000Z" }),
      tx("food", 100, { id: "newer", spent_at: "2026-06-20T00:00:00.000Z" }),
    ]);
    expect(rows[0].items.map((i) => i.id)).toEqual(["newer", "older"]);
  });

  it("carries memo through onto items (null when absent)", () => {
    const rows = aggregateVariableByCategory([
      tx("food", 100, { id: "withmemo", memo: "회식" }),
      tx("food", 200, { id: "nomemo" }),
    ]);
    const items = rows[0].items;
    expect(items.find((i) => i.id === "withmemo")?.memo).toBe("회식");
    expect(items.find((i) => i.id === "nomemo")?.memo).toBeNull();
  });
});

describe("fixedTotal", () => {
  it("sums effective amounts over ALL items (override-aware)", () => {
    expect(fixedTotal([fixed("a", 1000), fixed("b", 500)])).toBe(1500);
  });
  it("treats null amount as 0", () => {
    expect(fixedTotal([fixed("a", 1000), fixed("b", null)])).toBe(1000);
  });
  it("includes items that mapFixedItems would hide (amount 0)", () => {
    const items = [fixed("a", 1000), fixed("zero", 0)];
    expect(fixedTotal(items)).toBe(1000);
    expect(mapFixedItems(items).map((r) => r.id)).toEqual(["a"]);
  });
  it("is 0 for an empty array", () => {
    expect(fixedTotal([])).toBe(0);
  });
});

describe("mapFixedItems — catalog grouping (B: group total desc, amount desc within)", () => {
  it("orders groups by total desc and items by amount desc within a group", () => {
    const rows = mapFixedItems([
      fixed("netflix", 4_100, { category: "OTT" }),
      fixed("savings", 700_000, { category: null }), // 직접추가
      fixed("bus", 55_000, { category: "교통" }),
      fixed("isa", 300_000, { category: null }), // 직접추가
    ]);
    // 직접추가 group total = 1,000,000 (largest) → first, amount desc inside;
    // then 교통 (55,000); then OTT (4,100).
    expect(rows.map((r) => r.id)).toEqual(["savings", "isa", "bus", "netflix"]);
  });

  it("keeps a single (all-manual) group sorted by amount desc", () => {
    const rows = mapFixedItems([
      fixed("c", 10_000),
      fixed("a", 90_000),
      fixed("b", 30_000),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("drops items with no positive amount", () => {
    const rows = mapFixedItems([
      fixed("ok", 5_000),
      fixed("zero", 0),
      fixed("nullamt", null),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["ok"]);
  });

  it("returns [] for an empty array", () => {
    expect(mapFixedItems([])).toEqual([]);
  });

  // 전월比 (replaces the old base-vs-override delta)
  it("leaves delta null when no previous data is supplied", () => {
    const [row] = mapFixedItems([fixed("loan", 180_820)]);
    expect(row.delta).toBeNull();
  });

  it("computes positive delta when this cycle costs more than last cycle", () => {
    const cur = [fixed("loan", 180_820, { category: null })];
    const prev = [fixed("loan", 180_000, { category: null })];
    const [row] = mapFixedItems(cur, prev);
    expect(row.delta).toBe(820);
  });

  it("computes negative delta when this cycle costs less", () => {
    const [row] = mapFixedItems(
      [fixed("loan", 170_000)],
      [fixed("loan", 180_000)],
    );
    expect(row.delta).toBe(-10_000);
  });

  it("leaves delta null for an item that didn't exist last cycle", () => {
    const [row] = mapFixedItems(
      [fixed("new", 5_000)],
      [fixed("other", 9_000)],
    );
    expect(row.delta).toBeNull();
  });

  it("emits delta 0 for an unchanged item (view hides it)", () => {
    const [row] = mapFixedItems(
      [fixed("netflix", 4_100)],
      [fixed("netflix", 4_100)],
    );
    expect(row.delta).toBe(0);
  });
});

describe("fixedDelta — 전월比 헤드라인 고정분 (matched-only)", () => {
  it("sums amount−prev for items present (>0) in both cycles", () => {
    const cur = [fixed("loan", 180_820), fixed("phone", 19_790)];
    const prev = [fixed("loan", 180_000), fixed("phone", 30_600)];
    // (180_820 − 180_000) + (19_790 − 30_600) = 820 − 10_810 = −9_990
    expect(fixedDelta(cur, prev)).toBe(-9_990);
  });

  it("excludes a bill unrecorded last cycle (prev null → no phantom +)", () => {
    // 전기세: this cycle has an override, last cycle was never entered (amount null).
    // Naive fixedTotal(this)−fixedTotal(prev) would count +64_990; matched-only drops it.
    const cur = [fixed("elec", 64_990)];
    const prev = [fixed("elec", null)];
    expect(fixedDelta(cur, prev)).toBe(0);
    // contrast: the naive total-difference would have over-counted
    expect(fixedTotal(cur) - fixedTotal(prev)).toBe(64_990);
  });

  it("excludes a genuinely new item (absent last cycle)", () => {
    expect(fixedDelta([fixed("new", 5_000)], [fixed("other", 9_000)])).toBe(0);
  });

  it("excludes an item dropped this cycle (this null → not a negative)", () => {
    // mapFixedItems hides amount≤0 rows, so the headline must not count −prev either.
    expect(fixedDelta([fixed("elec", null)], [fixed("elec", 50_000)])).toBe(0);
  });

  it("equals the sum of visible mapFixedItems row deltas (invariant)", () => {
    const cur = [fixed("loan", 180_820), fixed("phone", 19_790), fixed("elec", 64_990)];
    const prev = [fixed("loan", 180_000), fixed("phone", 30_600), fixed("elec", null)];
    const rowDeltaSum = mapFixedItems(cur, prev).reduce(
      (s, r) => s + (r.delta ?? 0),
      0,
    );
    expect(fixedDelta(cur, prev)).toBe(rowDeltaSum);
  });

  it("is 0 when there is no previous data", () => {
    expect(fixedDelta([fixed("loan", 180_820)], [])).toBe(0);
  });
});

describe("sortVariableItems", () => {
  const item = (
    id: string,
    amount: number,
    spentAt: string,
  ): VariableBreakdownItem => ({ id, amount, spentAt, memo: null });

  it("amount mode: amount desc, tie-break newest first (matches aggregate order)", () => {
    const items = [
      item("a", 100, "2026-06-01T00:00:00.000Z"),
      item("b", 300, "2026-06-02T00:00:00.000Z"),
      item("c", 100, "2026-06-03T00:00:00.000Z"),
    ];
    expect(sortVariableItems(items, "amount").map((i) => i.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("date mode: newest first, tie-break amount desc", () => {
    const items = [
      item("a", 500, "2026-06-01T00:00:00.000Z"),
      item("b", 100, "2026-06-03T00:00:00.000Z"),
      item("c", 900, "2026-06-03T00:00:00.000Z"),
    ];
    expect(sortVariableItems(items, "date").map((i) => i.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("amount asc: exact reverse of amount desc (tie-break flips too)", () => {
    const items = [
      item("a", 100, "2026-06-01T00:00:00.000Z"),
      item("b", 300, "2026-06-02T00:00:00.000Z"),
      item("c", 100, "2026-06-03T00:00:00.000Z"),
    ];
    expect(
      sortVariableItems(items, "amount", "asc").map((i) => i.id),
    ).toEqual(["a", "c", "b"]);
  });

  it("date asc: oldest first, exact reverse of date desc", () => {
    const items = [
      item("a", 500, "2026-06-01T00:00:00.000Z"),
      item("b", 100, "2026-06-03T00:00:00.000Z"),
      item("c", 900, "2026-06-03T00:00:00.000Z"),
    ];
    expect(sortVariableItems(items, "date", "asc").map((i) => i.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("omitted direction defaults to desc", () => {
    const items = [
      item("a", 100, "2026-06-01T00:00:00.000Z"),
      item("b", 300, "2026-06-02T00:00:00.000Z"),
    ];
    expect(sortVariableItems(items, "amount")).toEqual(
      sortVariableItems(items, "amount", "desc"),
    );
  });

  it("does not mutate the input array", () => {
    const items = [
      item("a", 100, "2026-06-01T00:00:00.000Z"),
      item("b", 300, "2026-06-02T00:00:00.000Z"),
    ];
    const snapshot = items.map((i) => i.id);
    sortVariableItems(items, "date", "asc");
    expect(items.map((i) => i.id)).toEqual(snapshot);
  });

  it("returns [] for empty input", () => {
    expect(sortVariableItems([], "amount")).toEqual([]);
  });
});
