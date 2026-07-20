# Floating Glass Navbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 티끌 하단 4탭 nav를 인스타그램 스타일 floating glass pill(스크롤 방향 연동 morph, drawer freeze)로 재구현한다.

**Architecture:** DOM은 항상 확장 레이아웃으로 렌더하고, 축소는 컴포지터-세이프 속성(transform/opacity)으로만 표현한다. 컨테이너 shape는 고정 지오메트리 glass 레이어 2장의 opacity 크로스페이드, 탭 아이콘은 CSS 변수 기반 translate로 연속 morph. 스크롤 방향 판정은 순수 함수 reducer로 분리해 vitest로 커버하고, drawer 열림 동안은 ref-count freeze 싱글턴으로 상태 갱신을 동결한다.

**Tech Stack:** Next.js 16 / React 19 / Tailwind v4 (CSS-first) / vaul / vitest

**Spec:** `docs/superpowers/specs/2026-07-20-floating-glass-navbar-design.md`

## Global Constraints

- iOS Safari PWA가 1차 타겟 — box-size(width/height) **transition 금지**, 애니메이션은 `transform`/`opacity`만 (스펙 §3, 저장소 실측 교훈).
- 탭은 4개 고정: `/dashboard` 소비 / `/fixed-expenses` 고정지출 / `/savings` 돈모으기 / `/income` 수입. 5개 이상 금지 (DESIGN.md §11.2).
- 탭 타겟 ≥ 44px 양 상태 모두 (DESIGN.md §17).
- `prefers-reduced-motion: reduce` → transition 제거, 즉시 스냅.
- 모든 사용자 노출 문자열 한국어, 코드 주석·식별자 영어.
- import는 `@/*` 경로 별칭.
- 매 태스크 후 `pnpm test:run` (util 변경 시), 커밋은 태스크 단위.
- AppShell padBottom은 확장 상태 기준 상수 고정 — 축소 시 콘텐츠 reflow 금지.
- 기하 상수: 확장 pill 높이 64px, 축소 시각 높이 52px, 축소 슬롯 48px, 축소 pill 폭 208px(4×48+16), 바닥 마진 12px, transition 260ms `cubic-bezier(0.32,0.72,0,1)`.

---

### Task 1: 스펙 §5.2 보정 (clip-path → twin-layer crossfade)

**Files:**
- Modify: `docs/superpowers/specs/2026-07-20-floating-glass-navbar-design.md` §5.2, §8

**이유:** `clip-path`는 element의 painted output 전체(box-shadow·border 포함)를 클리핑한다. 축소 상태에서 floating shadow와 하이라이트 border가 잘려 사라진다. 또한 hit-area 분석 결과, Link 박스를 확장 슬롯 폭(~97px) 그대로 translate하면 축소 시 인접 탭 hit-area가 겹친다.

- [ ] **Step 1: §5.2 전환 메커니즘 교체**

§5.2의 1번 항목(컨테이너 클리핑)을 다음으로 교체:

```markdown
1. **컨테이너 크로스페이드**: 고정 지오메트리 glass 레이어 2장(확장형: rail 폭 × 64px radius 32px / 축소형: 208×52px 중앙 배치 rounded-full)을 `opacity`로 교차 전환한다. 각 레이어가 자기 bg·backdrop-blur·border·shadow를 온전히 소유하므로 clip-path의 "painted output 전체가 잘려 shadow/border가 사라지는" 문제가 없다. 아이콘 4개가 연속 translate로 움직이므로 컨테이너가 크로스페이드여도 morph로 읽힌다.
```

§5.3에서 `--clip-x`/`--clip-y` 계산식 삭제 (translate 계산식은 유지). §8에 다음 추가:

```markdown
- Link hit-box는 양 상태 공통 **48px 고정 폭** (슬롯 중앙 배치, ≥44px 충족). 확장 슬롯 전체(~97px)를 hit-area로 쓰면 축소 translate 시 인접 탭과 겹쳐 오탭이 발생하므로 금지.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-07-20-floating-glass-navbar-design.md
git commit -m "docs(nav): 스펙 §5.2 보정 — clip-path가 shadow/border를 클리핑하는 결함 수정, twin-layer crossfade로 교체"
```

---

### Task 2: nav-freeze 유틸 (TDD)

**Files:**
- Create: `lib/utils/nav-freeze.ts`
- Test: `lib/utils/nav-freeze.test.ts`

**Interfaces:**
- Produces: `createNavFreeze(apply: (frozen: boolean) => void)` → `{ acquire(): void; release(): void; readonly frozen: boolean }`, 그리고 DOM 반영이 연결된 싱글턴 `navFreeze` (Task 4·6이 소비).

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/utils/nav-freeze.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { createNavFreeze } from "./nav-freeze";

describe("createNavFreeze", () => {
  it("starts unfrozen", () => {
    const freeze = createNavFreeze(() => {});
    expect(freeze.frozen).toBe(false);
  });

  it("freezes on first acquire and calls apply(true) once", () => {
    const apply = vi.fn();
    const freeze = createNavFreeze(apply);
    freeze.acquire();
    expect(freeze.frozen).toBe(true);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(true);
  });

  it("stays frozen while nested acquires remain (drawer-in-drawer)", () => {
    const apply = vi.fn();
    const freeze = createNavFreeze(apply);
    freeze.acquire(); // outer drawer
    freeze.acquire(); // nested drawer (e.g. category picker)
    freeze.release(); // nested closes
    expect(freeze.frozen).toBe(true);
    expect(apply).toHaveBeenCalledTimes(1); // only the 0→1 edge
  });

  it("unfreezes only when count returns to zero", () => {
    const apply = vi.fn();
    const freeze = createNavFreeze(apply);
    freeze.acquire();
    freeze.acquire();
    freeze.release();
    freeze.release();
    expect(freeze.frozen).toBe(false);
    expect(apply).toHaveBeenLastCalledWith(false);
    expect(apply).toHaveBeenCalledTimes(2); // true then false
  });

  it("clamps release below zero (unbalanced release is a no-op)", () => {
    const apply = vi.fn();
    const freeze = createNavFreeze(apply);
    freeze.release();
    expect(freeze.frozen).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    freeze.acquire();
    expect(freeze.frozen).toBe(true); // counter didn't go negative
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test:run lib/utils/nav-freeze.test.ts`
Expected: FAIL — `Cannot find module './nav-freeze'` 류.

- [ ] **Step 3: 구현**

`lib/utils/nav-freeze.ts`:

```ts
// Ref-counted freeze flag for the bottom nav's scroll-collapse behavior.
// While any bottom sheet is open, iOS keyboard focus scrolls the *layout*
// viewport (see components/ui/drawer.tsx), which fires window scroll events
// and would toggle the nav behind the sheet — freeze suppresses that.
type ApplyFrozen = (frozen: boolean) => void;

export function createNavFreeze(apply: ApplyFrozen) {
  let count = 0;
  return {
    acquire() {
      count += 1;
      if (count === 1) apply(true);
    },
    release() {
      if (count === 0) return;
      count -= 1;
      if (count === 0) apply(false);
    },
    get frozen() {
      return count > 0;
    },
  };
}

// Module-level singleton shared by DrawerContent (acquire/release) and
// useNavCollapsed (reads .frozen). The dataset write is for debuggability
// only — consumers read the getter, not the DOM.
export const navFreeze = createNavFreeze((frozen) => {
  if (typeof document === "undefined") return;
  if (frozen) document.documentElement.dataset.navFreeze = "1";
  else delete document.documentElement.dataset.navFreeze;
});
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test:run lib/utils/nav-freeze.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 전체 스위트 무회귀 확인 후 커밋**

Run: `pnpm test:run`
Expected: 전체 PASS.

```bash
git add lib/utils/nav-freeze.ts lib/utils/nav-freeze.test.ts
git commit -m "feat(nav): ref-count nav-freeze 유틸 추가 — drawer 열림 동안 스크롤 morph 동결용"
```

---

### Task 3: 스크롤 방향 reducer (TDD)

**Files:**
- Create: `lib/utils/nav-collapse.ts`
- Test: `lib/utils/nav-collapse.test.ts`

**Interfaces:**
- Produces: `NAV_SCROLL_DELTA = 8`, `NAV_TOP_THRESHOLD = 24`, `type NavScrollState = { collapsed: boolean; lastY: number }`, `nextNavScrollState(state, y, frozen): NavScrollState` (Task 6이 소비).

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/utils/nav-collapse.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  NAV_SCROLL_DELTA,
  NAV_TOP_THRESHOLD,
  nextNavScrollState,
  type NavScrollState,
} from "./nav-collapse";

const at = (collapsed: boolean, lastY: number): NavScrollState => ({
  collapsed,
  lastY,
});

describe("nextNavScrollState", () => {
  it("collapses on downward scroll past the delta threshold", () => {
    const next = nextNavScrollState(at(false, 100), 100 + NAV_SCROLL_DELTA, false);
    expect(next).toEqual({ collapsed: true, lastY: 100 + NAV_SCROLL_DELTA });
  });

  it("expands on upward scroll past the delta threshold", () => {
    const next = nextNavScrollState(at(true, 300), 300 - NAV_SCROLL_DELTA, false);
    expect(next).toEqual({ collapsed: false, lastY: 300 - NAV_SCROLL_DELTA });
  });

  it("ignores jitter below the delta threshold (state object unchanged)", () => {
    const state = at(true, 300);
    expect(nextNavScrollState(state, 300 + NAV_SCROLL_DELTA - 1, false)).toBe(state);
    expect(nextNavScrollState(state, 300 - NAV_SCROLL_DELTA + 1, false)).toBe(state);
  });

  it("always expands near the top regardless of direction", () => {
    const next = nextNavScrollState(at(true, 200), NAV_TOP_THRESHOLD - 1, false);
    expect(next.collapsed).toBe(false);
  });

  it("always expands on iOS rubber-band negative scrollY", () => {
    const next = nextNavScrollState(at(true, 10), -30, false);
    expect(next.collapsed).toBe(false);
  });

  it("is a no-op while frozen (drawer open)", () => {
    const state = at(false, 100);
    expect(nextNavScrollState(state, 500, true)).toBe(state);
  });

  it("re-syncs lastY on the first event after unfreeze without collapsing", () => {
    // While frozen, the iOS keyboard may scroll the layout viewport far from
    // lastY. The first post-unfreeze event must re-anchor, not treat the
    // stale gap as a user scroll.
    const frozenAt = at(false, 100);
    const next = nextNavScrollState(frozenAt, 400, false, { resync: true });
    expect(next).toEqual({ collapsed: false, lastY: 400 });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test:run lib/utils/nav-collapse.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`lib/utils/nav-collapse.ts`:

```ts
// Pure reducer for the bottom nav's scroll-direction collapse. Kept free of
// DOM/React so the decision logic is unit-testable (vitest, node env).

/** Deltas below this are treated as iOS momentum/rubber-band jitter. */
export const NAV_SCROLL_DELTA = 8;
/** Within this distance from the top the nav is always expanded. */
export const NAV_TOP_THRESHOLD = 24;

export type NavScrollState = {
  collapsed: boolean;
  lastY: number;
};

type Options = {
  /** First event after an unfreeze: re-anchor lastY without judging direction. */
  resync?: boolean;
};

export function nextNavScrollState(
  state: NavScrollState,
  y: number,
  frozen: boolean,
  options: Options = {},
): NavScrollState {
  if (frozen) return state;
  if (y < NAV_TOP_THRESHOLD) {
    if (!state.collapsed && state.lastY === y) return state;
    return { collapsed: false, lastY: y };
  }
  if (options.resync) return { collapsed: state.collapsed, lastY: y };
  const delta = y - state.lastY;
  if (Math.abs(delta) < NAV_SCROLL_DELTA) return state;
  return { collapsed: delta > 0, lastY: y };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test:run lib/utils/nav-collapse.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: 전체 스위트 + 커밋**

Run: `pnpm test:run`
Expected: 전체 PASS.

```bash
git add lib/utils/nav-collapse.ts lib/utils/nav-collapse.test.ts
git commit -m "feat(nav): 스크롤 방향 collapse reducer 추가 — 순수 함수, 델타 8px·최상단 24px·freeze·resync 규칙"
```

---

### Task 4: DrawerContent freeze 연결

**Files:**
- Modify: `components/ui/drawer.tsx` (DrawerContent 함수, 현재 94–230행)

**Interfaces:**
- Consumes: `navFreeze` (Task 2).

- [ ] **Step 1: import 추가**

`components/ui/drawer.tsx` 상단 import 블록에:

```ts
import { navFreeze } from "@/lib/utils/nav-freeze";
```

- [ ] **Step 2: DrawerContent에 acquire/release effect 추가**

`DrawerContent` 함수 본문, 기존 iOS 키보드 useEffect 앞에 추가:

```ts
  // Freeze the bottom nav's scroll-collapse while any sheet is mounted.
  // vaul unmounts Content on close, so mount/unmount is exactly open/close.
  // Nested sheets stack acquires; the ref-count keeps the nav frozen until
  // the last one closes.
  React.useEffect(() => {
    navFreeze.acquire();
    return () => navFreeze.release();
  }, []);
```

- [ ] **Step 3: 빌드·테스트 확인**

Run: `pnpm test:run && pnpm lint`
Expected: PASS. (컴포넌트 테스트 스위트는 없음 — util 무회귀 + lint만.)

- [ ] **Step 4: Commit**

```bash
git add components/ui/drawer.tsx
git commit -m "feat(nav): DrawerContent 마운트 동안 nav-freeze 획득 — 모든 bottom sheet 자동 커버"
```

---

### Task 5: `--bottom-nav-clearance` 변수화 (제로 시각 변화 리팩터)

**Files:**
- Modify: `app/globals.css` (`:root` 블록, 7행 부근)
- Modify: `components/layout/app-shell.tsx:34-45`
- Modify: `components/transactions/add-transaction-button.tsx:37`
- Modify: `components/savings/savings-view.tsx:144`
- Modify: `components/income/income-view.tsx:180`

**Interfaces:**
- Produces: CSS 변수 `--bottom-nav-clearance`, `--surface-glass` (Task 6·7이 소비).

**검산 (기존값과 동일해야 함):** 기존 nav 76px docked 기준 `76px + safe + 16px` = `safe + 92px`. 새 변수 `safe + 12px + 64px` = `safe + 76px`, `+16px` = `safe + 92px`. **동일** — 이 태스크만 배포돼도 시각 변화 없음.

- [ ] **Step 1: globals.css `:root`에 변수 추가**

`app/globals.css`의 `:root` 블록(7행) 안에 추가:

```css
  /* Bottom-nav geometry, single source of truth. FABs and AppShell padding
     derive from this — change here, not at call sites.
     12px = pill bottom float margin, 64px = expanded pill height. */
  --bottom-nav-clearance: calc(env(safe-area-inset-bottom) + 12px + 64px);
  /* Glass surface (DESIGN.md §4). Light-only today; dark variant is
     rgba(28, 28, 30, 0.72) when dark mode ships. */
  --surface-glass: rgba(255, 255, 255, 0.72);
```

- [ ] **Step 2: AppShell padBottom을 변수 기반으로**

`components/layout/app-shell.tsx` 34–45행의 주석과 삼항을 교체:

```tsx
  // Bottom-fixed UI eats vertical space:
  // - Floating pill nav: --bottom-nav-clearance (globals.css, safe-area 포함)
  // - FAB: 56px tall, sits 16px above the nav (per add-transaction-button.tsx)
  // - FixedComposer: page owns its own padding; AppShell stays out of the way.
  // Padding is constant against the EXPANDED nav — the collapsed pill must
  // never reflow content.
  const padBottom = withFab
    ? "pb-[calc(var(--bottom-nav-clearance)+16px+56px+16px)]"
    : withBottomNav
      ? "pb-[calc(var(--bottom-nav-clearance)+24px)]"
      : withFixedComposer
        ? "pb-0"
        : "pb-28";
```

- [ ] **Step 3: FAB 3곳 bottom 교체**

세 파일 모두 동일 교체 — `bottom: "calc(76px + env(safe-area-inset-bottom) + 16px)"` →

```ts
bottom: "calc(var(--bottom-nav-clearance) + 16px)",
```

대상: `components/transactions/add-transaction-button.tsx:37`, `components/savings/savings-view.tsx:144`, `components/income/income-view.tsx:180`.

- [ ] **Step 4: 하드코딩 잔존 확인**

Run: `grep -rn "76px" components/ app/ --include="*.tsx" --include="*.css"`
Expected: 매치 0건 (app-shell 주석 포함 전부 제거됨).

- [ ] **Step 5: 테스트·lint 후 커밋**

Run: `pnpm test:run && pnpm lint`
Expected: PASS.

```bash
git add app/globals.css components/layout/app-shell.tsx components/transactions/add-transaction-button.tsx components/savings/savings-view.tsx components/income/income-view.tsx
git commit -m "refactor(nav): nav clearance를 --bottom-nav-clearance CSS 변수로 중앙화 — FAB 3곳·AppShell 참조, 시각 변화 없음"
```

---

### Task 6: `useNavCollapsed` 훅

**Files:**
- Create: `hooks/use-nav-collapsed.ts`

**Interfaces:**
- Consumes: `nextNavScrollState`/`NavScrollState` (Task 3), `navFreeze` (Task 2).
- Produces: `useNavCollapsed(): boolean` (Task 7이 소비).

- [ ] **Step 1: 훅 구현**

`hooks/use-nav-collapsed.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

import {
  nextNavScrollState,
  type NavScrollState,
} from "@/lib/utils/nav-collapse";
import { navFreeze } from "@/lib/utils/nav-freeze";

/**
 * Scroll-direction collapse state for the floating bottom nav.
 * - passive window scroll listener, rAF-throttled (one state check per frame)
 * - frozen (any bottom sheet open) → no updates; first event after unfreeze
 *   re-anchors lastY instead of treating the keyboard-induced scroll gap as
 *   a user gesture (see lib/utils/nav-collapse.ts)
 */
export function useNavCollapsed(): boolean {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let state: NavScrollState = { collapsed: false, lastY: window.scrollY };
    let wasFrozen = false;
    let raf = 0;

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const frozen = navFreeze.frozen;
        const next = nextNavScrollState(state, window.scrollY, frozen, {
          resync: wasFrozen && !frozen,
        });
        if (!frozen) wasFrozen = false;
        else wasFrozen = true;
        if (next.collapsed !== state.collapsed) setCollapsed(next.collapsed);
        state = next;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return collapsed;
}
```

- [ ] **Step 2: lint·타입 확인**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-nav-collapsed.ts
git commit -m "feat(nav): useNavCollapsed 훅 — rAF 스로틀 스크롤 방향 감지 + freeze/resync 연동"
```

---

### Task 7: BottomTabNav floating pill 재작성

**Files:**
- Modify: `components/layout/bottom-tab-nav.tsx` (전면 재작성)

**Interfaces:**
- Consumes: `useNavCollapsed` (Task 6), `--surface-glass`·`--bottom-nav-clearance`는 렌더 위치 계산에 간접 관여 (Task 5).

**기하 요약:** 확장 = rail 폭(`max-w-md − 2×20px`) × 64px, radius 32px. 축소 = 208×52px 중앙, rounded-full. 아이콘 translate 목표는 마운트/리사이즈 시 1회 계산해 CSS 변수 주입. Link hit-box는 상시 48px 폭(오탭 방지 — 스펙 §5.2/§8 보정).

- [ ] **Step 1: 파일 전면 교체**

`components/layout/bottom-tab-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, HandCoins, Sprout, Wallet } from "lucide-react";

import { useNavCollapsed } from "@/hooks/use-nav-collapsed";
import { LinkPending } from "@/components/layout/nav-progress";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  Icon: typeof Wallet;
};

const TABS: Tab[] = [
  { href: "/dashboard", label: "소비", Icon: Wallet },
  { href: "/fixed-expenses", label: "고정지출", Icon: CalendarDays },
  { href: "/savings", label: "돈모으기", Icon: Sprout },
  { href: "/income", label: "수입", Icon: HandCoins },
];

// Collapsed-pill geometry (px). Keep in sync with the spec §5 and with
// --bottom-nav-clearance in globals.css (12px float + 64px expanded height).
const SLOT_W = 48;
const COLLAPSED_W = TABS.length * SLOT_W + 16; // 208
const EXPANDED_H = 64;
const COLLAPSED_H = 52;
// Icon drops to the collapsed pill's vertical center once the label fades.
const COLLAPSED_TY = 8;

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const DURATION = "260ms";

export function BottomTabNav() {
  const pathname = usePathname();
  const collapsed = useNavCollapsed();
  const navRef = useRef<HTMLElement>(null);

  // Rail width varies with viewport (≤ max-w-md). Derive each tab's
  // collapse translate target once per mount/resize — never per frame —
  // and expose them as CSS vars so the transition runs purely on the
  // compositor (transform/opacity only; box-size transitions are banned
  // on iOS, see spec §3).
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const apply = () => {
      const railW = el.offsetWidth;
      TABS.forEach((_, i) => {
        const expandedCx = ((i + 0.5) / TABS.length) * railW;
        const collapsedCx = railW / 2 + (i - (TABS.length - 1) / 2) * SLOT_W;
        el.style.setProperty(`--tx-${i}`, `${collapsedCx - expandedCx}px`);
      });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="주요 네비게이션"
      className="fixed inset-x-5 z-40 mx-auto h-16 w-auto max-w-[calc(28rem-40px)]"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      {/* Twin glass layers — fixed geometry each, opacity crossfade only.
          Each owns its full bg/blur/border/shadow, so nothing gets clipped
          away mid-morph (a single clip-path'd surface would clip its own
          box-shadow and border — spec §5.2). */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-[32px]",
          "border border-white/45 bg-[var(--surface-glass)] shadow-[0_12px_40px_rgba(0,0,0,0.14)]",
          "supports-[backdrop-filter:blur(1px)]:backdrop-blur-xl",
          "supports-[not(backdrop-filter:blur(1px))]:bg-white/95",
          "transition-opacity motion-reduce:transition-none",
          collapsed ? "opacity-0" : "opacity-100",
        )}
        style={{ transitionDuration: DURATION, transitionTimingFunction: EASE }}
      />
      <div
        aria-hidden
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
          "border border-white/45 bg-[var(--surface-glass)] shadow-[0_12px_40px_rgba(0,0,0,0.14)]",
          "supports-[backdrop-filter:blur(1px)]:backdrop-blur-xl",
          "supports-[not(backdrop-filter:blur(1px))]:bg-white/95",
          "transition-opacity motion-reduce:transition-none",
          collapsed ? "opacity-100" : "opacity-0",
        )}
        style={{
          width: COLLAPSED_W,
          height: COLLAPSED_H,
          transitionDuration: DURATION,
          transitionTimingFunction: EASE,
        }}
      />

      <ul className="relative grid h-full grid-cols-4">
        {TABS.map(({ href, label, Icon }, i) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex items-stretch justify-center">
              <Link
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                  // Fixed 48px hit-box in BOTH states (≥44px, spec §8):
                  // full-slot-width links would overlap once translated.
                  "flex w-12 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  "transition-transform motion-reduce:transition-none",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                style={{
                  transform: collapsed
                    ? `translate(var(--tx-${i}), ${COLLAPSED_TY}px)`
                    : "translate(0px, 0px)",
                  transitionDuration: DURATION,
                  transitionTimingFunction: EASE,
                }}
              >
                <Icon
                  className={cn(
                    "size-5 shrink-0",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "transition-opacity motion-reduce:transition-none",
                    // Fade the label out fast ahead of the shape change, and
                    // back in slightly late so text never overlaps the
                    // collapsed pill boundary (spec §5.2-3).
                    collapsed ? "opacity-0 duration-120" : "opacity-100 delay-100 duration-150",
                  )}
                >
                  {label}
                </span>
                <LinkPending />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

주의:
- twin 레이어의 `width`/`height`는 **상수 스타일이며 transition 대상이 아님** — box-size 금지 규칙 위반 아님.
- `EXPANDED_H`는 `h-16`(64px) 클래스와 이중 표기 — 상수는 주석·문서 동기화용으로만 존재. lint에서 unused면 제거해도 됨.
- 라벨 `duration-120`은 Tailwind 임의값(`duration-[120ms]`)으로 동작 안 하면 교체.

- [ ] **Step 2: lint·빌드 확인**

Run: `pnpm lint && pnpm build`
Expected: PASS. (`bg-background`·`border-t`가 사라졌으므로 이전 docked 스타일 흔적 없음.)

- [ ] **Step 3: Commit**

```bash
git add components/layout/bottom-tab-nav.tsx
git commit -m "feat(nav): BottomTabNav를 floating glass pill로 재작성 — twin-layer crossfade + 아이콘 translate morph"
```

---

### Task 8: DESIGN.md 개정 (5건)

**Files:**
- Modify: `DESIGN.md` §7·§8·§11.2·§12.10/§12.11·§19

- [ ] **Step 1: §7 Surfaces — 글래스모피즘 금지 해제**

현행 (403행 부근):

```
bottom navigation은 backdrop-blur + 반투명 background로 단순하게 처리한다. iOS Safari 류의 글래스모피즘은 사용하지 않는다 (§19).
```

교체:

```
bottom navigation은 floating glass pill이다: `--surface-glass` 배경 + backdrop-blur-xl + 1px 화이트 하이라이트 보더 + soft shadow, 화면 바닥에서 12px 떠 있다. backdrop-filter 미지원 환경(구형 Samsung Internet)은 `@supports` 분기로 불투명도를 높인 배경으로 폴백한다. glass 표면은 nav와 §7 기존 허용 표면 외로 확장하지 않는다.
```

- [ ] **Step 2: §8 Motion — nav morph 허용 사례 추가**

§8 "사용 예" 목록에 추가:

```
- 하단 nav 확장↔축소 morph (260ms cubic-bezier(0.32,0.72,0,1), transform/opacity만 — box-size transition 금지, reduced-motion 시 즉시 스냅)
```

- [ ] **Step 3: §11.2 — floating pill 동작 명세**

§11.2 본문에 다음 단락 추가:

```
nav는 docked bar가 아니라 floating pill이다. 확장 상태(아이콘+라벨, rail 폭)가 기본이며, 아래로 스크롤하면 라벨이 사라지고 아이콘 4개만 남은 컴팩트 pill(208×52px)로 morph한다. 위로 스크롤하거나 최상단(24px 미만)이면 다시 확장된다. bottom sheet(DrawerContent)가 열려 있는 동안 morph는 동결된다(iOS 키보드의 layout viewport 스크롤 오작동 방지). 콘텐츠 하단 패딩과 FAB 위치는 확장 상태 기준 상수(`--bottom-nav-clearance`)로 고정한다 — 축소가 레이아웃을 reflow시키지 않는다.
```

- [ ] **Step 4: §12.10·§12.11 — FAB 위치 서술 갱신**

두 섹션에서 FAB 위치를 언급하는 문장을 `--bottom-nav-clearance + 16px` 기준으로 갱신 (하드코딩 76px 서술이 있으면 제거).

- [ ] **Step 5: §19 — Don't 항목 축소**

현행 (1483행 부근):

```
- Apple 브랜드나 고유 UI(글래스모피즘 탭 스위처 등)를 복제하지 않는다.
```

교체:

```
- Apple 브랜드·아이콘·고유 UI를 복제하지 않는다. (glass 표면 자체는 §7의 nav 명세 범위에서 허용)
```

- [ ] **Step 6: Commit**

```bash
git add DESIGN.md
git commit -m "docs(nav): DESIGN.md 개정 — floating glass pill nav 하우스 스타일 승격 (§7·§8·§11.2·§12.10-11·§19)"
```

---

### Task 9: 통합 검증 (브라우저 POC 루프)

**Files:** 코드 변경은 발견된 결함 수정에 한정.

- [ ] **Step 1: 전체 스위트**

Run: `pnpm test:run && pnpm test:utc && pnpm lint && pnpm build`
Expected: 전부 PASS.

- [ ] **Step 2: 브라우저 검증 루프**

in-app Browser pane에서 dev 서버(`.claude/launch.json` 경유) + 모바일 뷰포트(375×812)로:

1. `/dashboard` 로그인 상태 — 확장 pill 렌더(glass·radius·shadow), 스크린샷.
2. 아래로 스크롤 → 축소 morph(라벨 페이드 + 아이콘 모임 + pill 크로스페이드), 스크린샷.
3. 위로 소폭 스크롤 → 즉시 확장. 최상단 러버밴드 → 확장 유지.
4. 축소 상태에서 4개 탭 각각 탭 → 올바른 라우트 이동 (hit-box 겹침 검증).
5. FAB 위치가 pill 위 16px에 있는지 (`/dashboard`·`/savings`·`/income` 3곳).
6. 소비 추가 drawer 열기 → 내부 스크롤·텍스트 입력 포커스 → 닫기 → nav 상태가 열기 전과 동일한지 (freeze 검증).
7. 콘솔 에러 0건 확인 (`read_console_messages`).

- [ ] **Step 3: 발견 결함 수정 → Step 1부터 재실행**

- [ ] **Step 4: iOS 실기기 백로그 등록**

메모리 `ios-verification-backlog`에 추가: "floating glass navbar — 60fps morph 체감·backdrop-blur 렌더·safe-area·러버밴드 지터·drawer freeze, 실기기 확인 필요".

- [ ] **Step 5: 최종 커밋 (수정분 있을 때만)**

```bash
git add -A && git commit -m "fix(nav): 브라우저 검증 루프에서 발견된 결함 수정"
```
