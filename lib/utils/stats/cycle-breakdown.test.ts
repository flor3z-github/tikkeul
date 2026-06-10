import { describe, expect, it } from "vitest";

import {
  aggregateVariableByCategory,
  fixedTotal,
  grandTotal,
  mapFixedItems,
  variableTotal,
  type FixedEffectiveItem,
  type VariableTxInput,
} from "@/lib/utils/stats/cycle-breakdown";

// NOTE: this layer is timezone-agnostic — it groups already-fetched rows and
// sums amounts, never touching dates. Cycle [start, end) boundaries AND the
// previous-cycle window are resolved by lib/utils/payday-cycle.ts (covered in
// payday-cycle.test.ts, incl. getPreviousCycleB). So there are deliberately NO
// TZ tests below — only aggregation, grouping, and delta invariants.

function tx(
  category_id: string | null,
  amount: number,
  meta?: Partial<VariableTxInput>,
): VariableTxInput {
  return {
    amount,
    category_id,
    category_name: meta?.category_name ?? (category_id ? category_id : null),
    category_icon: meta?.category_icon ?? null,
    category_color: meta?.category_color ?? null,
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

describe("grandTotal", () => {
  it("equals variableTotal + fixedTotal (dashboard totalSpent)", () => {
    const txs = [tx("a", 300), tx("b", 200)];
    const items = [fixed("f1", 1000), fixed("f2", null)];
    expect(grandTotal(txs, items)).toBe(variableTotal(txs) + fixedTotal(items));
    expect(grandTotal(txs, items)).toBe(1500);
  });
});
