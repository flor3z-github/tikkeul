# payday 설정 /settings → /income 이동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "돈 들어오는 날"(payday + 급여 규정) 편집 컨트롤을 /settings에서 /income 탭으로 옮긴다.

**Architecture:** settings-form의 payday row+drawer 로직을 새 `components/income/payday-cycle-drawer.tsx`로 이관하고, /income 페이지가 이미 로드하는 payday/rule/holidays를 그 컴포넌트에 전달한다. 공용 로직(`useAutoSave`/`SaveIndicator`, payday group↔db 매퍼)은 별도 모듈로 추출해 닉네임 폼·온보딩·새 컴포넌트가 공유한다. 저장 동작(명시적 "저장" 버튼 commit, dismiss 폐기)은 그대로 보존한다.

**Tech Stack:** Next.js 16 App Router(RSC + Server Actions), React 19, Tailwind v4, shadcn/ui, vaul Drawer, vitest.

## Global Constraints

- 통화는 KRW 정수. 사용자 대상 문자열은 한국어, 주석·식별자는 영어.
- import는 `@/*` 별칭만 (상대 `../../..` 금지).
- Server Action 반환은 `{ ok: true } | { ok: false; error: string }` (또는 redirect).
- 타깃은 iOS Safari PWA + Samsung Internet PWA. midDay picker는 **native `<select>`** 유지(vaul portal 충돌·base-ui Select 금지). bottom-sheet는 반드시 `DrawerContent` 사용.
- payday 계산 엔진(`lib/utils/payday-cycle.ts`)의 기존 함수 동작은 변경 금지 — 순수 매퍼 함수만 **추가**.
- `saveCycleAction`은 cross-cutting(대시보드·친구도 주기 의존) → 파일 위치 `app/settings/actions.ts` 유지, revalidate 대상만 추가.
- payday DB 값 규약: `0 = 말일`, `1..28 = 그 날` (payday 29..31은 제공 안 함).
- 매 변경 후 `pnpm test:run` 실행. UI-only 변경은 "util 회귀 없음"만 증명 — 실화면은 iOS PWA(사람) 몫.

---

### Task 1: payday group↔db 공유 매퍼 + 온보딩 리팩터

payday picker의 3버킷(`first`/`mid`/`last`)과 DB `payday` smallint 간 매핑을 순수 함수로 추출해 온보딩·(이후) income 컴포넌트가 공유한다. CLAUDE.md 규약("inline 복제 대신 단일 매퍼") 선제 충족 + 온보딩 stale 주석 갱신.

**Files:**
- Modify: `lib/utils/payday-cycle.ts` (매퍼 + 타입 추가)
- Test: `lib/utils/payday-cycle.test.ts` (매퍼 케이스 추가)
- Modify: `app/onboarding/_components/onboarding-flow.tsx:19-24,89,97`

**Interfaces:**
- Produces:
  - `type PaydayGroup = "first" | "mid" | "last"`
  - `paydayGroupToDb(group: PaydayGroup, midDay: number): number` — `first→1`, `last→0`, `mid→midDay`.
  - `groupForPayday(payday: number): PaydayGroup` — `0→"last"`, `>=2→"mid"`, else `"first"`.

- [ ] **Step 1: Write the failing test**

`lib/utils/payday-cycle.test.ts` 하단에 append:

```ts
describe("paydayGroupToDb / groupForPayday — picker↔db mapping", () => {
  it("maps groups to db payday", () => {
    expect(paydayGroupToDb("first", 25)).toBe(1);
    expect(paydayGroupToDb("last", 25)).toBe(0);
    expect(paydayGroupToDb("mid", 25)).toBe(25);
    expect(paydayGroupToDb("mid", 2)).toBe(2);
  });

  it("maps db payday back to group (inverse for 1/0/mid)", () => {
    expect(groupForPayday(1)).toBe("first");
    expect(groupForPayday(0)).toBe("last");
    expect(groupForPayday(25)).toBe("mid");
    expect(groupForPayday(2)).toBe("mid");
  });

  it("round-trips every offered selection", () => {
    expect(groupForPayday(paydayGroupToDb("first", 25))).toBe("first");
    expect(groupForPayday(paydayGroupToDb("last", 25))).toBe("last");
    for (let d = 2; d <= 28; d++) {
      expect(groupForPayday(paydayGroupToDb("mid", d))).toBe("mid");
    }
  });
});
```

그리고 이 파일 상단 import 블록(`import { ... } from "@/lib/utils/payday-cycle"`)에 `paydayGroupToDb`, `groupForPayday`, `type PaydayGroup`를 추가한다.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run`
Expected: FAIL — `paydayGroupToDb`/`groupForPayday` is not exported / not a function.

- [ ] **Step 3: Add the mapper to `lib/utils/payday-cycle.ts`**

`export const PAYDAY_END_OF_MONTH = 0;` 바로 아래에 추가:

```ts
// Picker bucket ↔ DB payday mapping. The 돈 들어오는 날 picker offers 3 buckets
// that mirror the 3 distinct label/cycle behaviors: 1일 (first), 특정일 2..28
// (mid), 말일 (last). Single source shared by the /income payday drawer and the
// onboarding flow (CLAUDE.md: no inline duplication of this mapping).
export type PaydayGroup = "first" | "mid" | "last";

export function paydayGroupToDb(group: PaydayGroup, midDay: number): number {
  return group === "first" ? 1 : group === "last" ? PAYDAY_END_OF_MONTH : midDay;
}

export function groupForPayday(payday: number): PaydayGroup {
  return payday === PAYDAY_END_OF_MONTH ? "last" : payday >= 2 ? "mid" : "first";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run`
Expected: PASS (전체 스위트 그린).

- [ ] **Step 5: Refactor onboarding to use the shared mapper**

`app/onboarding/_components/onboarding-flow.tsx`:

19번 라인 import를 타입+매퍼로 확장:
```ts
import {
  groupForPayday,
  paydayGroupToDb,
  type PaydayGroup,
  type PayrollRule,
} from "@/lib/utils/payday-cycle";
```
(기존 `import type { PayrollRule } from "@/lib/utils/payday-cycle";` 대체.)

21~24번 라인의 stale 주석 + 로컬 `PaydayGroup` 타입 정의를 교체 — 로컬 `type PaydayGroup` 선언은 **삭제**(이제 util에서 import), `MID_DAY_OPTIONS`는 유지, 주석을 갱신:
```ts
// The 돈 들어오는 날 picker's 3 buckets map to user_settings.payday via the
// shared paydayGroupToDb (see lib/utils/payday-cycle.ts); the /income payday
// drawer uses the same mapper so new and existing users stay in lock-step.
const MID_DAY_OPTIONS = Array.from({ length: 27 }, (_, i) => i + 2); // 2..28
```

97번 라인의 inline 매핑을 매퍼 호출로 교체:
```ts
  const paydayDb = paydayGroupToDb(group, midDay);
```

(89번 `useState<PaydayGroup>("first")`는 import된 타입을 그대로 쓰므로 무변경. `groupForPayday`는 온보딩에선 아직 미사용이지만 import해도 무해 — lint 오류 방지 위해 실제로 안 쓰면 import에서 빼도 됨; 온보딩은 forward만 필요하니 `groupForPayday`는 import하지 않는다.)

정정: 19번 import는 온보딩이 실제 쓰는 것만 — `paydayGroupToDb`, `type PaydayGroup`, `type PayrollRule`:
```ts
import {
  paydayGroupToDb,
  type PaydayGroup,
  type PayrollRule,
} from "@/lib/utils/payday-cycle";
```

- [ ] **Step 6: Verify build + tests**

Run: `pnpm test:run` → PASS. 이어서 `pnpm build` → Compiled successfully (온보딩 타입 통과).

- [ ] **Step 7: Commit**

```bash
git add lib/utils/payday-cycle.ts lib/utils/payday-cycle.test.ts app/onboarding/_components/onboarding-flow.tsx
git commit -m "refactor(payday): group↔db 매퍼 추출, 온보딩이 공용 사용

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `useAutoSave` + `SaveIndicator` 공유 모듈 추출

닉네임 폼과 (Task 3의) payday 컴포넌트가 공유하도록 자동저장 훅/인디케이터를 별도 파일로 옮긴다. 동작 무변경 리팩터.

**Files:**
- Create: `components/settings/auto-save.tsx`
- Modify: `components/settings/settings-form.tsx` (정의 삭제 + import)

**Interfaces:**
- Produces:
  - `type SaveStatus = "idle" | "saving" | "saved"`
  - `useAutoSave(): { status: SaveStatus; save: (action: () => Promise<ActionResult>, onError?: () => void) => Promise<boolean> }`
  - `SaveIndicator({ status }: { status: SaveStatus }): JSX.Element | null`
  - (내부 타입) `ActionResult = { ok: true } | { ok: false; error: string }`

- [ ] **Step 1: Create `components/settings/auto-save.tsx`**

settings-form.tsx의 `useAutoSave`/`SaveIndicator`/`SaveStatus`/`ActionResult`를 그대로 옮긴 새 파일:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

type ActionResult = { ok: true } | { ok: false; error: string };

export type SaveStatus = "idle" | "saving" | "saved";

// Per-field auto-save: drives a transient "저장 중…/저장됨 ✓" indicator and
// surfaces failures as a toast. The caller decides what to do with the field
// value on failure (text fields keep it, the cycle row reverts) via the
// returned boolean / onError.
export function useAutoSave() {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const save = useCallback(
    async (
      action: () => Promise<ActionResult>,
      onError?: () => void,
    ): Promise<boolean> => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      setStatus("saving");
      let res: ActionResult;
      try {
        res = await action();
      } catch {
        res = { ok: false, error: "저장에 실패했어요." };
      }
      if (res.ok) {
        setStatus("saved");
        timer.current = setTimeout(() => setStatus("idle"), 1500);
        return true;
      }
      setStatus("idle");
      toast.error(res.error);
      onError?.();
      return false;
    },
    [],
  );

  return { status, save };
}

export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span
      aria-live="polite"
      className="flex items-center gap-1 text-xs text-muted-foreground"
    >
      {status === "saving" ? (
        "저장 중…"
      ) : (
        <>
          <Check className="size-3.5 text-emerald-600" aria-hidden />
          저장됨
        </>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Update `settings-form.tsx` to import from the shared module**

`settings-form.tsx`에서 로컬 `type ActionResult`, `type SaveStatus`, `function useAutoSave`, `function SaveIndicator` 정의를 **삭제**하고, import 블록에 추가:
```ts
import { SaveIndicator, useAutoSave } from "@/components/settings/auto-save";
```
`Check` 아이콘이 settings-form에서 더 이상 안 쓰이면 lucide import에서 제거(현재 `Check`는 SaveIndicator 전용 → 삭제). `toast`·`useCallback`도 다른 사용처 없으면 정리.

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: Compiled successfully. (`pnpm lint`의 전역 worktree-cruft 오류는 무시 — 변경 파일에 오류 없어야 함.)

- [ ] **Step 4: Commit**

```bash
git add components/settings/auto-save.tsx components/settings/settings-form.tsx
git commit -m "refactor(settings): useAutoSave·SaveIndicator를 공유 모듈로 추출

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 새 payday 컴포넌트 + /income 배선 + revalidate

payday row+drawer를 `/income`에 신설한다. 이 시점엔 payday가 /settings·/income 양쪽에 나타나지만(과도기 중복) 둘 다 정상 동작한다 — Task 4에서 settings 쪽을 제거한다.

**Files:**
- Create: `components/income/payday-cycle-drawer.tsx`
- Modify: `components/income/income-view.tsx` (props + row 렌더)
- Modify: `app/income/page.tsx` (payday/rule/holidays를 IncomeView로 전달)
- Modify: `app/settings/actions.ts:89` (`revalidatePath("/income")` 추가)

**Interfaces:**
- Consumes: Task 1 `paydayGroupToDb`/`groupForPayday`/`PaydayGroup`, Task 2 `useAutoSave`/`SaveIndicator`, 기존 `saveCycleAction(payday: number, payrollRule: PayrollRule)`, `getCurrentCycleB`, `formatCycleLabelLong`.
- Produces: `PaydayCycleDrawer({ initialPayday, initialPayrollRule, holidays })`.

- [ ] **Step 1: Create `components/income/payday-cycle-drawer.tsx` — 컴포넌트 shell + row**

아래를 작성한다. `<Drawer>...</Drawer>` **본문 JSX는 `components/settings/settings-form.tsx`의 현행 Drawer 블록(현재 라인 314~534, `<Drawer open={pickerOpen} ...>` 여는 태그부터 닫는 `</Drawer>`까지)을 그대로 옮긴다** — 그 블록이 참조하는 state·핸들러(`pickerOpen`/`handlePickerOpenChange`/`group`/`setGroup`/`midDay`/`setMidDay`/`payrollRule`/`setPayrollRule`/`ruleOpen`/`setRuleOpen`/`cyclePreview`/`confirmCycle`, 상수 `MID_DAY_OPTIONS`/`PAYROLL_RULE_OPTIONS`/`payrollRuleLabel`)는 이름이 동일하게 이 컴포넌트에 존재하므로 본문은 무수정 이식이다.

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarSync, ChevronDown, ChevronRight } from "lucide-react";

import { saveCycleAction } from "@/app/settings/actions";
import { SaveIndicator, useAutoSave } from "@/components/settings/auto-save";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCycleLabelLong } from "@/lib/utils/calendar";
import { cn } from "@/lib/utils";
import {
  getCurrentCycleB,
  groupForPayday,
  paydayGroupToDb,
  type PaydayGroup,
  type PayrollRule,
} from "@/lib/utils/payday-cycle";

const PAYROLL_RULE_OPTIONS: {
  value: PayrollRule;
  label: string;
  example?: string;
}[] = [
  { value: "prev", label: "앞당겨 들어와요", example: "예: 토요일이면 금요일" },
  { value: "same", label: "날짜 그대로" },
  { value: "next", label: "미뤄서 들어와요", example: "예: 토요일이면 월요일" },
];

const PAYROLL_RULE_SHORT: Record<PayrollRule, string> = {
  prev: "이전 영업일",
  same: "날짜 그대로",
  next: "다음 영업일",
};

const MID_DAY_OPTIONS = Array.from({ length: 27 }, (_, i) => i + 2); // 2..28

function payrollRuleLabel(value: string | null): string {
  return PAYROLL_RULE_OPTIONS.find((opt) => opt.value === value)?.label ?? "";
}

type PaydayCycleDrawerProps = {
  initialPayday: number;
  initialPayrollRule: PayrollRule;
  holidays: string[];
};

export function PaydayCycleDrawer({
  initialPayday,
  initialPayrollRule,
  holidays,
}: PaydayCycleDrawerProps) {
  const [group, setGroup] = useState<PaydayGroup>(groupForPayday(initialPayday));
  const [midDay, setMidDay] = useState<number>(
    initialPayday >= 2 && initialPayday <= 28 ? initialPayday : 25,
  );
  const [payrollRule, setPayrollRule] =
    useState<PayrollRule>(initialPayrollRule);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const committingRef = useRef(false);

  const [savedPayday, setSavedPayday] = useState(initialPayday);
  const [savedRule, setSavedRule] = useState<PayrollRule>(initialPayrollRule);

  const cycleSave = useAutoSave();

  const holidaySet = useMemo(() => new Set(holidays), [holidays]);
  const paydayDb = useMemo(
    () => paydayGroupToDb(group, midDay),
    [group, midDay],
  );
  const cyclePreview = useMemo(() => {
    const range = getCurrentCycleB(paydayDb, payrollRule, holidaySet);
    return formatCycleLabelLong(range.start, range.end);
  }, [paydayDb, payrollRule, holidaySet]);

  const dayLabel =
    group === "first" ? "1일" : group === "last" ? "말일" : `${midDay}일`;
  const cycleSummary = `${dayLabel} · ${PAYROLL_RULE_SHORT[payrollRule]}`;

  // The cycle commits ONLY when "저장" is tapped. A backdrop tap / swipe-down /
  // ESC dismiss DISCARDS the unsaved selection (reverts to the last-saved
  // baseline); a failed save also reverts (revertCycle as onError).
  function revertCycle() {
    setGroup(groupForPayday(savedPayday));
    if (savedPayday >= 2 && savedPayday <= 28) setMidDay(savedPayday);
    setPayrollRule(savedRule);
  }

  async function commitCycle() {
    if (paydayDb === savedPayday && payrollRule === savedRule) return;
    const nextPayday = paydayDb;
    const nextRule = payrollRule;
    const ok = await cycleSave.save(
      () => saveCycleAction(nextPayday, nextRule),
      revertCycle,
    );
    if (ok) {
      setSavedPayday(nextPayday);
      setSavedRule(nextRule);
    }
  }

  function confirmCycle() {
    committingRef.current = true;
    void commitCycle();
    setPickerOpen(false);
  }

  function handlePickerOpenChange(open: boolean) {
    if (open) {
      setPickerOpen(true);
      return;
    }
    setPickerOpen(false);
    if (committingRef.current) {
      committingRef.current = false; // confirmCycle이 이미 저장 시작 — 재발화 무시
      return;
    }
    revertCycle(); // backdrop/스와이프/ESC → 미저장 편집 폐기
  }

  return (
    <>
      {/* 돈 들어오는 날 row — /income의 "월 수입" row와 형제로 읽히는 Card row.
          긴 값(예: "25일 · 이전 영업일")은 우측 정렬 대신 서브라인으로 내려
          좁은 화면에서 overflow하지 않게 한다. 저장 중엔 chevron 앞에
          SaveIndicator를 띄운다. */}
      <Card className="mt-3 rounded-3xl border-black/[0.08] bg-card py-0 shadow-none dark:border-white/[0.10]">
        <CardContent className="p-2">
          <button
            type="button"
            onClick={() => {
              committingRef.current = false; // 새 편집 세션 — 가드 리셋
              setPickerOpen(true);
            }}
            aria-haspopup="dialog"
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium leading-tight">
                돈 들어오는 날
              </p>
              <p className="mt-0.5 truncate text-[12px] leading-tight text-muted-foreground">
                {cycleSummary}
              </p>
            </div>
            <SaveIndicator status={cycleSave.status} />
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>
        </CardContent>
      </Card>

      {/* ↓↓↓ settings-form.tsx의 현행 Drawer 블록(라인 314~534)을 그대로 이식 ↓↓↓ */}
      <Drawer open={pickerOpen} onOpenChange={handlePickerOpenChange}>
        {/* ... DrawerContent 전체 (RadioGroup 3버킷 + midDay native select +
            급여 규정 접힘 패널 + cyclePreview + "저장" 버튼) ... */}
      </Drawer>
    </>
  );
}
```

- [ ] **Step 2: Wire the row into `income-view.tsx`**

`components/income/income-view.tsx`:

import 추가:
```ts
import { PaydayCycleDrawer } from "@/components/income/payday-cycle-drawer";
import type { PayrollRule } from "@/lib/utils/payday-cycle";
```

`IncomeViewProps`에 3개 필드 추가:
```ts
  /** DB payday: 0=말일, 1..28. Global cycle setting, editable on every cycle. */
  payday: number;
  payrollRule: PayrollRule;
  /** YYYY-MM-DD holiday strings for cycle-preview computation. */
  holidays: string[];
```

컴포넌트 시그니처 구조분해에 `payday`, `payrollRule`, `holidays` 추가.

"월 수입" Card 블록(현행 라인 89~113의 `{isCurrentCycle ? (...) : null}`) **바로 다음**에 payday row를 삽입 (항상 렌더 — isCurrentCycle 조건 밖):
```tsx
      <PaydayCycleDrawer
        initialPayday={payday}
        initialPayrollRule={payrollRule}
        holidays={holidays}
      />
```

- [ ] **Step 3: Pass props from `app/income/page.tsx`**

`app/income/page.tsx`의 `<IncomeView ... />`(현행 라인 114~122)에 props 추가 — `payday`, `rule`, `holidays`는 이미 스코프에 존재:
```tsx
      <IncomeView
        monthlyIncome={monthlyIncome}
        items={items}
        cycleStartDate={cycleStartDate}
        cycleEndDate={cycleEndDate}
        isCurrentCycle={isCurrentCycle}
        isFutureCycle={isFutureCycle}
        addDefaultDate={addDefaultDate}
        payday={payday}
        payrollRule={rule}
        holidays={Array.from(holidays)}
      />
```
(`holidays`는 page에서 `Set<string>` — `Array.from`으로 직렬화. `rule` 변수명 → prop `payrollRule`.)

- [ ] **Step 4: Add `/income` to `saveCycleAction` revalidation**

`app/settings/actions.ts`의 `saveCycleAction` 내 revalidate 블록(현행 라인 89~91)에 한 줄 추가:
```ts
  revalidatePath("/dashboard");
  revalidatePath("/income");
  revalidatePath("/settings");
  revalidatePath("/friends");
```

- [ ] **Step 5: Verify build + tests**

Run: `pnpm test:run` → PASS (util 무변경). 이어서 `pnpm build` → Compiled successfully.

- [ ] **Step 6: Commit**

```bash
git add components/income/payday-cycle-drawer.tsx components/income/income-view.tsx app/income/page.tsx app/settings/actions.ts
git commit -m "feat(income): 돈 들어오는 날 설정을 수입 탭에 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: /settings에서 payday 제거

과도기 중복을 제거한다. settings-form은 닉네임 전용으로 축소, settings/page는 payday/holidays 로드를 제거한다.

**Files:**
- Modify: `components/settings/settings-form.tsx`
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: settings-form.tsx에서 payday 일체 제거**

`components/settings/settings-form.tsx`에서 아래를 삭제:
- import: `Drawer`/`DrawerContent`/`DrawerDescription`/`DrawerHeader`/`DrawerTitle`, `RadioGroup`/`RadioGroupItem`, `Label`(닉네임이 `Label` 쓰면 유지 — 확인 후 판단), `CalendarSync`/`ChevronDown`/`ChevronRight`, `formatCycleLabelLong`, `getCurrentCycleB`/`PayrollRule`, `cn`(다른 사용처 없으면).
- 상수/헬퍼: `PAYROLL_RULE_OPTIONS`, `PAYROLL_RULE_SHORT`, `PaydayGroup`, `MID_DAY_OPTIONS`, `payrollRuleLabel`, `groupForPayday`.
- props: `SettingsFormProps`에서 `initialPayday`, `initialPayrollRule`, `holidays` 제거. 시그니처 구조분해에서도 제거.
- state/로직: `group`/`midDay`/`payrollRule`/`ruleOpen`/`pickerOpen`/`committingRef`, `savedPayday`/`savedRule`, `cycleSave`, `holidaySet`/`paydayDb`/`cyclePreview`, `dayLabel`/`cycleSummary`, `revertCycle`/`commitCycle`/`confirmCycle`/`handlePickerOpenChange`.
- JSX: `<section className="mt-10 ...">예산</section>` 블록 전체(현행 라인 272~308) + 그 뒤 `<Drawer ...>...</Drawer>` 블록(라인 314~534) 삭제. 최상위 `<>...</>` 프래그먼트가 이제 `내 정보` section 하나만 감싸면 프래그먼트를 제거하고 그 section을 직접 반환해도 됨.

닉네임 관련(`nickname`/`setNickname`/`savedNickname`/`nicknameSave`/`handleNicknameBlur`, `내 정보` section)과 `useAutoSave`/`SaveIndicator` import(Task 2)는 **유지**.

- [ ] **Step 2: settings/page.tsx 단순화**

`app/settings/page.tsx`:
- `getHolidays`/`holidayRangeForAnchor` import + `const { yearStart, yearEnd } = holidayRangeForAnchor(...)` + `Promise.all`의 `getHolidays(...)` 항목 제거 (다른 소비자 없음).
- `user_settings` select에서 `payday, payroll_rule` 제거 → `"friend_spending_notifications, transaction_interaction_notifications"`만.
- `import { type PayrollRule } from "@/lib/utils/payday-cycle";` 제거(미사용).
- `<SettingsForm ... />`에서 `initialPayday`/`initialPayrollRule`/`holidays` props 제거 → `initialNickname`만 남김.

- [ ] **Step 3: Verify build + tests**

Run: `pnpm test:run` → PASS. `pnpm build` → Compiled successfully. `/settings`가 닉네임+알림+로그아웃만 남고 payday 없음, `/income`에만 payday 존재.

- [ ] **Step 4: Commit**

```bash
git add components/settings/settings-form.tsx app/settings/page.tsx
git commit -m "refactor(settings): 돈 들어오는 날 설정 제거(수입 탭으로 이관 완료)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: DESIGN.md 갱신 (문서-코드 일치)

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1: 라우팅표 (현행 라인 97~98)**

before:
```
/income          이번 주기 수입 현황·월 수입 수정·추가 수입 기록 (§12.11)
/settings        예산 주기·닉네임·로그아웃 (보조)
```
after:
```
/income          이번 주기 수입 현황·월 수입 수정·추가 수입 기록·예산 주기(돈 들어오는 날) (§12.11)
/settings        닉네임·알림·로그아웃 (보조)
```

- [ ] **Step 2: §12.5 / line 901 / §12.11 반영**

- 라인 893 부근("**예산** — 예산 주기(§12.5a) ...")과 라인 940("`components/settings/settings-form.tsx`는 picker 선택을 ... `saveCycleAction`로 자동저장한다"): picker가 이제 **`/income`의 `components/income/payday-cycle-drawer.tsx`**에 살고 `settings-form.tsx`는 **닉네임 전용**임을 반영. group↔payday 매핑은 `lib/utils/payday-cycle.ts`의 `paydayGroupToDb`/`groupForPayday`가 단일 출처이며 온보딩·income 컴포넌트가 공유한다고 정정(라인 940의 옛 `paydayCodeToDb`/`dbToPaydayCode`/`PAYDAY_OPTIONS`·`calendar.ts` 언급은 stale이므로 교체).
- 라인 901("월 수입 수정과 추가 수입 등록은 설정에 두지 않는다 ...")에 "**돈 들어오는 날(예산 주기)도 설정이 아닌 `/income`에서 관리한다**"를 추가.
- §12.11 본문에 payday row가 "월 수입" row 아래(모든 주기 노출) 위치한다는 한 줄 추가.

(정확한 문구는 주변 톤에 맞춰 서술 — 삭제 아닌 수정. 실제 라인 번호는 이전 태스크들 이후 다소 밀릴 수 있으니 텍스트 앵커로 찾을 것.)

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md
git commit -m "docs(design): 예산 주기(돈 들어오는 날) /income 이관 반영

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- 새 payday 컴포넌트 → Task 3 ✓
- useAutoSave/SaveIndicator 공유 추출 → Task 2 ✓
- 공유 매퍼(optional §3) → Task 1 ✓ (기본 채택)
- 배치(월 수입 row 아래, 모든 주기) → Task 3 Step 2 ✓
- saveCycleAction /income revalidate → Task 3 Step 4 ✓
- settings 정리 → Task 4 ✓
- DESIGN.md 갱신 → Task 5 ✓
- 온보딩 감사(변경 불필요) + 매퍼 공유 + stale 주석 → Task 1 Step 5 ✓

**Placeholder scan:** Task 3 Step 1의 Drawer 본문은 "verbatim move from settings-form.tsx:314~534"로 명시(플레이스홀더 아님 — 이식 대상 소스 범위 지정). 나머지 코드 스텝은 완전한 코드 포함.

**Type consistency:** `paydayGroupToDb`/`groupForPayday`/`PaydayGroup`(Task 1) → Task 3에서 동일 이름 사용 ✓. `useAutoSave`/`SaveIndicator`/`SaveStatus`(Task 2) → Task 3에서 동일 사용 ✓. `saveCycleAction(payday, payrollRule)` 시그니처 불변 ✓. IncomeView 새 props(`payday`/`payrollRule`/`holidays`) Task 3 Step 2·3 일치 ✓.

## 검증 한계

util(매퍼)만 테스트 커버. React 컴포넌트/드로어/저장 플로우는 컴포넌트 테스트 부재 → `pnpm build`(타입) + `pnpm test:run`(util 회귀)로만 자동 검증. 실화면(iOS Safari PWA)은 사람 확인: /income 새 row·drawer 열림/저장/dismiss 폐기/인디케이터, /settings 예산 섹션 제거 레이아웃, 온보딩 payday 캡처, 신규 유저 첫 /income payday 편집.
