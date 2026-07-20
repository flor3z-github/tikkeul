# /stats 변동지출 개별 거래 정렬 (날짜순/금액순) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** /stats 변동지출 카테고리 drill-down의 개별 거래 목록에 전역 「금액순/날짜순」 토글 추가.

**Architecture:** 순수 정렬 함수 `sortVariableItems`를 `lib/utils/stats/cycle-breakdown.ts`에 추가(테스트 먼저)하고, 클라이언트 컴포넌트 `VariableSection`이 `useState`로 모드를 들고 펼친 패널에서만 적용한다. 서버/DB/쿼리 변경 없음.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Tailwind v4.

## Global Constraints

- 기본값은 `"amount"` (금액 큰 순) — 현행 동작과 동일해야 함.
- 한국어 UI 카피: 「금액순」 「날짜순」. 코드 식별자/주석은 영어.
- 정렬 비교는 ISO 문자열 `localeCompare` — `new Date()` 파싱 금지 (TZ-agnostic 유지).
- 입력 배열 비변형 (복사 후 정렬).
- localStorage 저장 금지 — 세션 내 메모리 상태만.
- 테스트: `pnpm test:run` 및 `pnpm test:utc` 모두 green.

---

### Task 1: `sortVariableItems` util + 테스트

**Files:**
- Modify: `lib/utils/stats/cycle-breakdown.ts` (타입 export + 함수 추가, 기존 로직 불변)
- Test: `lib/utils/stats/cycle-breakdown.test.ts`

**Interfaces:**
- Consumes: 기존 `VariableBreakdownItem` 내부 타입 (`{ id, amount, spentAt, memo }`).
- Produces: `export type VariableBreakdownItem`, `export type VariableItemSortMode = "date" | "amount"`, `export function sortVariableItems(items: VariableBreakdownItem[], mode: VariableItemSortMode): VariableBreakdownItem[]` — Task 2가 import.

- [ ] **Step 1: Write the failing tests**

`lib/utils/stats/cycle-breakdown.test.ts` 끝에 추가 (기존 import 문에 `sortVariableItems`, `type VariableBreakdownItem` 추가):

```ts
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

  it("does not mutate the input array", () => {
    const items = [
      item("a", 100, "2026-06-01T00:00:00.000Z"),
      item("b", 300, "2026-06-02T00:00:00.000Z"),
    ];
    const snapshot = items.map((i) => i.id);
    sortVariableItems(items, "date");
    expect(items.map((i) => i.id)).toEqual(snapshot);
  });

  it("returns [] for empty input", () => {
    expect(sortVariableItems([], "amount")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run -- lib/utils/stats/cycle-breakdown.test.ts`
Expected: FAIL — `sortVariableItems` export 없음 (import 에러 또는 undefined).

- [ ] **Step 3: Write minimal implementation**

`lib/utils/stats/cycle-breakdown.ts`:

1. 58행 내부 타입에 `export` 추가:

```ts
/** One transaction inside a category, for the inline drill-down list. */
export type VariableBreakdownItem = {
  id: string;
  amount: number;
  spentAt: string;
  memo: string | null;
};
```

2. `aggregateVariableByCategory` 함수 뒤에 추가:

```ts
/** Sort mode for the drill-down transaction list on /stats. */
export type VariableItemSortMode = "date" | "amount";

/**
 * Re-sort a category's drill-down items for the /stats section-level toggle.
 * "amount" reproduces the aggregate's default order (amount desc, newest-first
 * tie-break); "date" is newest-first with amount-desc tie-break. ISO-string
 * comparison keeps this layer TZ-agnostic; input is never mutated.
 */
export function sortVariableItems(
  items: VariableBreakdownItem[],
  mode: VariableItemSortMode,
): VariableBreakdownItem[] {
  const sorted = [...items];
  if (mode === "date") {
    return sorted.sort(
      (a, b) => b.spentAt.localeCompare(a.spentAt) || b.amount - a.amount,
    );
  }
  return sorted.sort(
    (a, b) => b.amount - a.amount || b.spentAt.localeCompare(a.spentAt),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run -- lib/utils/stats/cycle-breakdown.test.ts`
Expected: PASS (신규 4개 + 기존 전부).

Run: `pnpm test:run` 후 `pnpm test:utc`
Expected: 전체 PASS 양쪽 모두.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/stats/cycle-breakdown.ts lib/utils/stats/cycle-breakdown.test.ts
git commit -m "feat(stats): 변동지출 drill-down 정렬 util sortVariableItems 추가"
```

---

### Task 2: `VariableSection` 정렬 토글 UI

**Files:**
- Modify: `components/stats/variable-section.tsx`

**Interfaces:**
- Consumes: Task 1의 `sortVariableItems`, `VariableItemSortMode` (`@/lib/utils/stats/cycle-breakdown`).
- Produces: 없음 (leaf UI).

- [ ] **Step 1: Add sort state + toggle to `VariableSection`**

`components/stats/variable-section.tsx` 수정.

import 변경 — 기존 type-only import를 확장:

```ts
import {
  sortVariableItems,
  type VariableBreakdownRow,
  type VariableItemSortMode,
} from "@/lib/utils/stats/cycle-breakdown";
```

`VariableSection` 본문 — `openKey` state 아래에 모드 state 추가, 헤딩과 카드 사이에 토글 삽입, `VariableRow`에 prop 전달:

```tsx
  // null = 모두 닫힘. 키는 categoryId(미분류는 "__uncat__").
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Section-global sort for the expanded drill-down lists. Default "amount"
  // preserves the pre-toggle behavior; in-memory only (no localStorage) since
  // sorting is a transient exploration state, not a lasting preference.
  const [sortMode, setSortMode] = useState<VariableItemSortMode>("amount");
  // delta가 하나라도 있을 때만 기준선 힌트를 단다 — 첫 사이클(전월比 off)엔 노이즈.
  const hasDelta = variableRows.some((r) => r.delta != null && r.delta !== 0);

  return (
    <section className="space-y-3">
      <SectionHeading
        title="변동지출"
        total={variableTotal}
        hint={hasDelta ? "↑↓ 직전 주기 같은 때 대비" : undefined}
      />
      <SortToggle mode={sortMode} onChange={setSortMode} />
      <SectionListCard>
        <ul>
          {variableRows.map((row) => {
            const key = row.categoryId ?? "__uncat__";
            return (
              <VariableRow
                key={key}
                row={row}
                open={openKey === key}
                sortMode={sortMode}
                onToggle={() =>
                  setOpenKey((cur) => (cur === key ? null : key))
                }
              />
            );
          })}
        </ul>
        {paymentSplit ? <NestedPaymentSplit split={paymentSplit} /> : null}
      </SectionListCard>
    </section>
  );
```

- [ ] **Step 2: Add the `SortToggle` component**

`NestedPaymentSplit` 위에 추가:

```tsx
const SORT_OPTIONS: { mode: VariableItemSortMode; label: string }[] = [
  { mode: "amount", label: "금액순" },
  { mode: "date", label: "날짜순" },
];

/**
 * Section-global sort toggle for the expanded transaction lists (§12.9). Two
 * plain text buttons (no shadcn Tabs — §9) right-aligned between the heading
 * and the list card; the active mode is emphasized via color/weight only.
 */
function SortToggle({
  mode,
  onChange,
}: {
  mode: VariableItemSortMode;
  onChange: (mode: VariableItemSortMode) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-3 px-1">
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.mode}
          type="button"
          aria-pressed={mode === opt.mode}
          onClick={() => onChange(opt.mode)}
          className={cn(
            "text-[12px] transition-colors",
            mode === opt.mode
              ? "font-semibold text-foreground"
              : "text-muted-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Apply the sort in `VariableRow`**

시그니처에 `sortMode` 추가, 펼친 패널에서만 정렬:

```tsx
function VariableRow({
  row,
  open,
  sortMode,
  onToggle,
}: {
  row: VariableBreakdownRow;
  open: boolean;
  sortMode: VariableItemSortMode;
  onToggle: () => void;
}) {
```

패널 렌더 부분 — `{row.items.map((item) => (` 를 정렬 적용으로 교체. `open ?` 분기 안이므로 닫힌 행은 정렬 계산 없음:

```tsx
      {open ? (
        <ul
          id={panelId}
          // pr-8(32px) = 부모 행 금액의 우측 인셋(버튼 px-1 4 + chevron 16 + gap-3 12)과
          // 맞춰, 펼친 거래 금액의 오른쪽 세로 라인이 부모 금액과 정렬되게 한다(chevron이
          // 없는 자식 행이 카드 끝까지 튀어나가는 것 방지).
          className="mb-1 ml-[52px] space-y-0.5 border-l border-border pl-3 pr-8 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {sortVariableItems(row.items, sortMode).map((item) => (
```

(map 내부 `<li>` 렌더는 기존 그대로.)

- [ ] **Step 4: Verify — lint, tests, build**

Run: `pnpm lint`
Expected: 에러 0.

Run: `pnpm test:run`
Expected: 전체 PASS (UI 변경이라 util 회귀 없음 확인 목적).

Run: `pnpm build`
Expected: 타입 에러 없이 빌드 성공.

- [ ] **Step 5: Commit**

```bash
git add components/stats/variable-section.tsx
git commit -m "feat(stats): 변동지출 개별 거래 금액순/날짜순 정렬 토글"
```

---

## 검증 노트

- 컴포넌트/e2e 스위트 없음 — 테스트는 "util 회귀 없음"까지만 증명. 토글 시각·터치
  체감은 iOS Safari PWA 실기기 확인이 별도로 필요 (프로젝트 표준 한계).
- 기본값 `"amount"`는 기존 정렬 비교자와 동일하므로 토글을 건드리지 않는 사용자에겐
  렌더 결과가 변하지 않아야 한다.
