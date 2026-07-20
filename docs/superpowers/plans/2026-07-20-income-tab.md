# 수입 탭 (하단 navbar 4탭 확장) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수입 관련 표면(설정 월 수입, 대시보드 income-line, FAB 롱프레스)을 하단 navbar 4번째 탭 `/income` 하나로 통합한다.

**Architecture:** DB 변경 없음. 기존 `user_settings.monthly_income` + `income_adjustments`를 새 RSC 라우트 `app/income/page.tsx`가 주기 엔진(`resolveDashboardParamsB`)으로 조회하고, 서버 액션 4개를 `app/income/actions.ts`로 이동. 대시보드·설정에서 수입 UI를 제거하고 FAB를 단순 탭 버튼으로 되돌린다. 화면 패턴은 /savings 평면 카탈로그형 재사용.

**Tech Stack:** Next.js 16 App Router(RSC + Server Actions), Supabase(RLS), Tailwind v4, vaul DrawerContent, lucide.

**Spec:** `docs/superpowers/specs/2026-07-20-income-tab-design.md`

## Global Constraints

- DB 마이그레이션 없음. `user_settings.monthly_income` 단일 숫자 유지.
- 사용자 문구 한국어, 코드 식별자·주석 영어(기존 파일의 한국어 주석 스타일은 그 파일 관례를 따름).
- import는 `@/*` 별칭만. 상대 `../..` 체인 금지.
- 서버 액션 반환: `{ ok: true } | { ok: false; error: string }` (+ add는 `{ ok: true; id }`), 실패는 sonner 토스트.
- 금액은 KRW 정수. `formatNumber`/`parseAmountInput`/`formatAmountInput` 사용, `Intl.NumberFormat` 직접 사용 금지.
- 바텀시트는 반드시 `components/ui/drawer.tsx`의 `DrawerContent`(또는 그 래퍼 `BottomSheet`) 사용.
- 탭 순서 고정: 소비(/dashboard) → 고정지출(/fixed-expenses) → 돈모으기(/savings) → 수입(/income). 수입 아이콘 `HandCoins`.
- 친구 모드에 수입 노출 금지 (bottom nav 자체가 own 모드 전용이라 자연 충족 — 새 노출 경로 만들지 말 것).
- 매 태스크 종료 시 `pnpm test:run` green 확인 후 커밋. 커밋·푸시는 사용자 confirm 후 진행(사용자 전역 규칙).
- 순수 util 신규 없음 → 신규 단위 테스트 없음. 타입 안전성은 최종 태스크의 `pnpm build`로 검증.

---

### Task 1: `app/income/actions.ts` — 수입 서버 액션 이동

**Files:**
- Create: `app/income/actions.ts`
- Modify: `app/dashboard/actions.ts` (364–527행 수입 섹션 + 373–408행 헬퍼 삭제)
- Modify: `app/settings/actions.ts` (51–80행 `saveIncomeAction` 삭제)
- Modify: `components/income/income-form-dialog.tsx:7-11` (import 경로 교체)
- Modify: `components/settings/settings-form.tsx:8` (import 경로 교체 — 필드 자체는 Task 5에서 제거)

**Interfaces:**
- Produces: `app/income/actions.ts`가 export하는 4개 액션 — `saveIncomeAction(income: number): Promise<{ok:true}|{ok:false;error:string}>`, `addIncomeAdjustmentAction(input: {amount:number; occurredOn:string; memo?:string|null}): Promise<{ok:true;id:string}|{ok:false;error:string}>`, `updateIncomeAdjustmentAction(input: {id:string; amount:number; occurredOn:string; memo?:string|null})`, `deleteIncomeAdjustmentAction(id: string)` (뒤 둘은 `{ok:true}|{ok:false;error:string}`). Task 2·5의 클라이언트가 이 시그니처를 import.
- Consumes: 없음 (기존 코드 이동).

- [ ] **Step 1: 새 액션 파일 작성**

`app/income/actions.ts` 전체 내용:

```ts
"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { nowInSeoul } from "@/lib/utils/date";

// -- Income surface actions ---------------------------------------------------
//
// Moved here from app/settings/actions.ts (saveIncomeAction) and
// app/dashboard/actions.ts (income adjustments) when the income tab became
// the single income surface. Per-cycle one-shot income (bonus, refund, side
// income) supplements the recurring `user_settings.monthly_income`; both are
// folded into effectiveIncome by the dashboard budget math. Friend mode never
// reads income_adjustments — RLS only grants access to the owning user.

type ActionResult = { ok: true } | { ok: false; error: string };

export type IncomeAdjustmentActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const INCOME_MEMO_MAX_LENGTH = 100;
const INCOME_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function normalizeMemo(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeOccurredOn(value: string): string {
  if (!INCOME_DATE_RE.test(value)) {
    throw new Error("올바른 날짜를 입력해주세요.");
  }
  // The DB column is `date`, so we keep the YYYY-MM-DD string as-is to
  // avoid Date round-trips that would re-introduce timezone drift.
  // Future-date check: parse in local tz and compare against today's date
  // (also local). The product's mental model is "what happened" tracking,
  // not budget projection — block future entries the same way the
  // transaction form does.
  const [, ys, ms, ds] = INCOME_DATE_RE.exec(value)!;
  const target = new Date(Number(ys), Number(ms) - 1, Number(ds));
  // KST wall-clock today — `new Date()` would be UTC on Vercel, wrongly
  // rejecting an entry dated *today* (KST) during 00:00-09:00 KST as "future".
  const now = nowInSeoul();
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  if (target.getTime() > todayEnd.getTime()) {
    throw new Error("미래 날짜는 등록할 수 없어요.");
  }
  return value;
}

export async function saveIncomeAction(income: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!Number.isFinite(income) || income < 0) {
    return { ok: false, error: "0원 이상으로 입력해주세요." };
  }
  const monthlyIncome = Math.trunc(income);

  // Partial upsert: only monthly_income. On a first-time insert the other
  // user_settings columns fall back to their DB defaults (payday=1,
  // payroll_rule='prev'); on update the untouched columns are preserved.
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, monthly_income: monthlyIncome },
      { onConflict: "user_id" },
    );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addIncomeAdjustmentAction(input: {
  amount: number;
  occurredOn: string;
  memo?: string | null;
}): Promise<IncomeAdjustmentActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "금액은 0원보다 커야 해요." };
  }

  let occurredOn: string;
  try {
    occurredOn = normalizeOccurredOn(input.occurredOn);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "날짜 오류",
    };
  }

  const memo = normalizeMemo(input.memo);
  if (memo !== null && memo.length > INCOME_MEMO_MAX_LENGTH) {
    return {
      ok: false,
      error: `메모는 ${INCOME_MEMO_MAX_LENGTH}자까지 입력할 수 있어요.`,
    };
  }

  const id = randomUUID();
  const { error } = await supabase.from("income_adjustments").insert({
    id,
    user_id: user.id,
    occurred_on: occurredOn,
    amount: input.amount,
    memo,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true, id };
}

export async function updateIncomeAdjustmentAction(input: {
  id: string;
  amount: number;
  occurredOn: string;
  memo?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!input.id) return { ok: false, error: "수정할 항목이 없어요." };

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "금액은 0원보다 커야 해요." };
  }

  let occurredOn: string;
  try {
    occurredOn = normalizeOccurredOn(input.occurredOn);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "날짜 오류",
    };
  }

  const memo = normalizeMemo(input.memo);
  if (memo !== null && memo.length > INCOME_MEMO_MAX_LENGTH) {
    return {
      ok: false,
      error: `메모는 ${INCOME_MEMO_MAX_LENGTH}자까지 입력할 수 있어요.`,
    };
  }

  const { error } = await supabase
    .from("income_adjustments")
    .update({ occurred_on: occurredOn, amount: input.amount, memo })
    .eq("id", input.id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteIncomeAdjustmentAction(
  id: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!id) return { ok: false, error: "삭제할 항목이 없어요." };

  const { error } = await supabase
    .from("income_adjustments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return { ok: true };
}
```

주의: `normalizeMemo`/`normalizeOccurredOn`은 원본에서 verbatim 복사 (dashboard/actions.ts:44-48, 380-408). dashboard 쪽 `normalizeMemo`는 transaction 액션이 계속 쓰므로 **남긴다**.

- [ ] **Step 2: 원본에서 수입 코드 삭제**

`app/dashboard/actions.ts`에서 삭제:
- 364–375행 수입 섹션 주석 + `export type IncomeAdjustmentActionResult`
- 377–378행 `INCOME_MEMO_MAX_LENGTH`, `INCOME_DATE_RE`
- 380–408행 `normalizeOccurredOn`
- 410–527행 `addIncomeAdjustmentAction` / `updateIncomeAdjustmentAction` / `deleteIncomeAdjustmentAction`

삭제 후 `nowInSeoul` import가 다른 곳에서 안 쓰이면 제거 (grep으로 확인 — transaction 쪽에서 쓰면 유지).

`app/settings/actions.ts`에서 51–80행 `saveIncomeAction` 전체 삭제.

- [ ] **Step 3: import 경로 교체**

`components/income/income-form-dialog.tsx` 7–11행:

```ts
import {
  addIncomeAdjustmentAction,
  deleteIncomeAdjustmentAction,
  updateIncomeAdjustmentAction,
} from "@/app/income/actions";
```

`components/settings/settings-form.tsx` 8행의 `saveIncomeAction` import를 `@/app/income/actions`로 교체 (다른 settings 액션 import와 분리된 줄로).

- [ ] **Step 4: 검증**

Run: `pnpm test:run`
Expected: 전체 PASS (util 테스트 무변경).

Run: `grep -rn "IncomeAdjustmentActionResult\|addIncomeAdjustmentAction\|saveIncomeAction" app components --include="*.ts*" | grep -v "app/income/actions"`
Expected: import 참조가 전부 `@/app/income/actions`를 가리킴. `app/dashboard/actions.ts`·`app/settings/actions.ts`에 수입 심볼 잔존 없음.

- [ ] **Step 5: Commit** (사용자 confirm 후)

```bash
git add app/income/actions.ts app/dashboard/actions.ts app/settings/actions.ts components/income/income-form-dialog.tsx components/settings/settings-form.tsx
git commit -m "refactor(수입): 수입 서버 액션을 app/income/actions.ts로 이동"
```

---

### Task 2: `/income` 페이지 + 뷰 컴포넌트

**Files:**
- Modify: `app/dashboard/_components/month-switcher.tsx` (`basePath` prop 추가)
- Create: `app/income/page.tsx`
- Create: `components/income/income-view.tsx`
- Create: `components/income/monthly-income-sheet.tsx`

**Interfaces:**
- Consumes: Task 1의 `saveIncomeAction` (`@/app/income/actions`), 기존 `IncomeFormDialog`(`@/components/income/income-form-dialog`, props: `open onOpenChange cycleStart:Date cycleEnd:Date defaultDate:string initial?`), `resolveDashboardParamsB(sp, payday, rule, holidays, now)` → `{ym, cycleStart, cycleEnd, cycleLabel}`, `getHolidays`/`holidayRangeForAnchor`, `BottomSheet`(`@/components/ui/bottom-sheet`).
- Produces: `IncomeView` props `{monthlyIncome:number; items:IncomeAdjustmentItem[]; cycleStartDate:string; cycleEndDate:string; isCurrentCycle:boolean; addDefaultDate:string}` — Task 3 이후 navbar가 이 라우트로 진입.

- [ ] **Step 1: MonthSwitcher에 basePath prop**

`app/dashboard/_components/month-switcher.tsx` 수정 — props에 `basePath`(기본 `"/dashboard"`) 추가, `buildHref`가 사용:

```ts
type MonthSwitcherProps = {
  ym: string;
  cycleLabel: string;
  /** Route the prev/next links target. The income tab reuses this switcher
   *  with its own path; dashboard callers keep the default. */
  basePath?: string;
};

export function MonthSwitcher({
  ym,
  cycleLabel,
  basePath = "/dashboard",
}: MonthSwitcherProps) {
```

`buildHref` 반환을 `` `${basePath}?${params.toString()}` ``로 교체. 기존 호출부(`calendar-day-panel.tsx:394`)는 무변경.

- [ ] **Step 2: `app/income/page.tsx` 작성**

```tsx
import Link from "next/link";
import { Settings } from "lucide-react";
import { redirect } from "next/navigation";

import { MonthSwitcher } from "@/app/dashboard/_components/month-switcher";
import { IncomeView } from "@/components/income/income-view";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { buttonVariants } from "@/components/ui/button";
import { getHolidays, holidayRangeForAnchor } from "@/lib/queries/holidays";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { parseYearMonth } from "@/lib/utils/calendar";
import { nowInSeoul, toISODate } from "@/lib/utils/date";
import {
  resolveDashboardParamsB,
  type PayrollRule,
} from "@/lib/utils/payday-cycle";

type IncomeSearchParams = Promise<{ ym?: string }>;

export default async function IncomePage({
  searchParams,
}: {
  searchParams: IncomeSearchParams;
}) {
  const sp = await searchParams;

  const supabase = await createClient();
  // getClaims (local JWKS verify) — same auth pattern as the dashboard; RLS
  // still fences every query below.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) redirect("/login");

  // Holidays for the viewed anchor year ±1 (cycles cross year boundaries).
  const anchorYear =
    parseYearMonth(sp.ym ?? "")?.getFullYear() ?? new Date().getFullYear();
  const { yearStart, yearEnd } = holidayRangeForAnchor(anchorYear);
  const [settingsRes, holidays] = await Promise.all([
    supabase
      .from("user_settings")
      .select("payday, payroll_rule, monthly_income")
      .eq("user_id", userId)
      .maybeSingle(),
    getHolidays(yearStart, yearEnd, supabase),
  ]);

  const payday = Number(settingsRes.data?.payday ?? 1);
  const rule = (settingsRes.data?.payroll_rule ?? "prev") as PayrollRule;
  const monthlyIncome = Number(settingsRes.data?.monthly_income ?? 0);

  const now = nowInSeoul();
  const { ym, cycleStart, cycleEnd, cycleLabel } = resolveDashboardParamsB(
    { ym: sp.ym },
    payday,
    rule,
    holidays,
    now,
  );
  const cycleStartDate = toISODate(cycleStart);
  const cycleEndDate = toISODate(cycleEnd);

  // Adjustments in the viewed cycle. Compared as YYYY-MM-DD against the
  // `date`-typed occurred_on column — no timezone round-trips.
  const adjustmentsRes = await supabase
    .from("income_adjustments")
    .select("id, amount, occurred_on, memo")
    .eq("user_id", userId)
    .gte("occurred_on", cycleStartDate)
    .lt("occurred_on", cycleEndDate)
    .order("occurred_on", { ascending: false })
    .order("id", { ascending: false });

  const items = (adjustmentsRes.data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount ?? 0),
    occurredOn: row.occurred_on,
    memo: row.memo,
  }));

  const isCurrentCycle =
    now.getTime() >= cycleStart.getTime() && now.getTime() < cycleEnd.getTime();
  // Add-form default date: today on the live cycle; the cycle's last day
  // (exclusive end − 1) on past cycles so the picker opens inside range.
  const lastDay = new Date(cycleEnd.getTime() - 86_400_000);
  const addDefaultDate = isCurrentCycle ? toISODate(now) : toISODate(lastDay);

  return (
    <AppShell withBottomNav>
      <PageHeader
        eyebrow="이번 주기 들어온 돈"
        title="수입"
        trailing={
          <Link
            href="/settings"
            prefetch
            aria-label="설정"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "rounded-full text-muted-foreground",
            )}
          >
            <Settings className="size-5" />
          </Link>
        }
      />

      <div className="mt-2">
        <MonthSwitcher ym={ym} cycleLabel={cycleLabel} basePath="/income" />
      </div>

      <IncomeView
        monthlyIncome={monthlyIncome}
        items={items}
        cycleStartDate={cycleStartDate}
        cycleEndDate={cycleEndDate}
        isCurrentCycle={isCurrentCycle}
        addDefaultDate={addDefaultDate}
      />
    </AppShell>
  );
}
```

참고: 대시보드처럼 `force-dynamic` export는 쓰지 않는다 — 세션 쿠키 의존 쿼리가 이미 dynamic을 강제하고, PPR(`cacheComponents`) 하에서 dashboard/page.tsx도 별도 opt-in 없이 동작 중. `pnpm build`에서 prerender 에러가 나면 그때 `export const dynamic = "force-dynamic"`을 추가한다.

- [ ] **Step 3: `components/income/income-view.tsx` 작성**

```tsx
"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";

import {
  IncomeFormDialog,
  type IncomeAdjustmentInitial,
} from "@/components/income/income-form-dialog";
import { MonthlyIncomeSheet } from "@/components/income/monthly-income-sheet";
import { Card, CardContent } from "@/components/ui/card";
import { formatKoreanShortDate } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/money";

export type IncomeAdjustmentItem = {
  id: string;
  amount: number;
  occurredOn: string;
  memo: string | null;
};

type IncomeViewProps = {
  monthlyIncome: number;
  items: IncomeAdjustmentItem[];
  /** YYYY-MM-DD, inclusive cycle start. */
  cycleStartDate: string;
  /** YYYY-MM-DD, exclusive cycle end. */
  cycleEndDate: string;
  isCurrentCycle: boolean;
  /** YYYY-MM-DD pre-fill for the add form (today, or past cycle's last day). */
  addDefaultDate: string;
};

// Parse YYYY-MM-DD into a local-midnight Date — matches IncomeFormDialog's
// own parsing so calendar boundary checks line up (no UTC drift).
function parseYmd(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function IncomeView({
  monthlyIncome,
  items,
  cycleStartDate,
  cycleEndDate,
  isCurrentCycle,
  addDefaultDate,
}: IncomeViewProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeAdjustmentInitial | null>(null);
  const [monthlyOpen, setMonthlyOpen] = useState(false);

  const cycleStart = useMemo(() => parseYmd(cycleStartDate), [cycleStartDate]);
  const cycleEnd = useMemo(() => parseYmd(cycleEndDate), [cycleEndDate]);

  const extraTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.amount, 0),
    [items],
  );
  const total = monthlyIncome + extraTotal;

  return (
    <>
      {/* HERO — cycle total income (§3: the screen's biggest number). */}
      <Card className="mt-4 rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">
            이번 주기 총 수입
          </p>
          <p className="mt-2 flex items-baseline gap-1">
            <span className="text-[40px] font-bold leading-none tracking-[-0.045em] tabular-nums">
              {formatNumber(total)}
            </span>
            <span className="text-[19px] font-bold">원</span>
          </p>
          <p className="mt-2 text-[12px] tabular-nums text-muted-foreground">
            월 수입 {formatNumber(monthlyIncome)}원
            {extraTotal > 0 ? ` · 추가 ${formatNumber(extraTotal)}원` : ""}
          </p>
        </CardContent>
      </Card>

      {/* 월 수입 row — editable only on the live cycle. Past cycles show the
          hero breakdown alone (monthly income has no stored history; the
          displayed value is today's setting — a documented approximation). */}
      {isCurrentCycle ? (
        <Card className="mt-3 rounded-3xl border-black/[0.08] bg-card py-0 shadow-none dark:border-white/[0.10]">
          <CardContent className="p-2">
            <button
              type="button"
              onClick={() => setMonthlyOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-tight">월 수입</p>
                <p className="mt-0.5 text-[12px] leading-tight text-muted-foreground">
                  매달 들어오는 실수령 금액
                </p>
              </div>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                {formatNumber(monthlyIncome)}원
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </button>
          </CardContent>
        </Card>
      ) : null}

      {/* 추가 수입 list. */}
      <section className="mt-6 space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[15px] font-semibold tracking-[-0.015em]">
            추가 수입{" "}
            {items.length > 0 ? (
              <span className="font-medium tabular-nums text-muted-foreground/70">
                {items.length}
              </span>
            ) : null}
          </h2>
          {items.length > 0 ? (
            <span className="text-[12.5px] font-medium text-muted-foreground">
              최신순
            </span>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            이번 주기엔 추가 수입이 없어요.
          </p>
        ) : (
          <Card className="rounded-3xl border-black/[0.08] bg-card py-2 shadow-none dark:border-white/[0.10]">
            <CardContent className="p-2">
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted active:bg-muted"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold tabular-nums leading-tight">
                          +{formatNumber(item.amount)}원
                        </p>
                        <p className="mt-0.5 truncate text-[12px] leading-tight text-muted-foreground">
                          {formatKoreanShortDate(parseYmd(item.occurredOn))}
                          {item.memo ? ` · ${item.memo}` : ""}
                        </p>
                      </div>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-border py-3 text-[14px] font-semibold text-muted-foreground transition-all duration-150 ease-out hover:bg-muted active:scale-[0.99]"
        >
          <Plus className="size-4" strokeWidth={2.6} />
          추가 수입 기록
        </button>
      </section>

      {/* Add / edit share the same drawer, keyed by initial (form-dialog
          pattern). Not nested — no parent drawer on this page. */}
      <IncomeFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        defaultDate={addDefaultDate}
      />
      <IncomeFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        defaultDate={editing?.occurredOn ?? addDefaultDate}
        initial={editing ?? undefined}
      />

      <MonthlyIncomeSheet
        open={monthlyOpen}
        onOpenChange={setMonthlyOpen}
        initialIncome={monthlyIncome}
      />
    </>
  );
}
```

- [ ] **Step 4: `components/income/monthly-income-sheet.tsx` 작성**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveIncomeAction } from "@/app/income/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAmountInput, parseAmountInput } from "@/lib/utils/money";

type MonthlyIncomeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIncome: number;
};

export function MonthlyIncomeSheet({
  open,
  onOpenChange,
  initialIncome,
}: MonthlyIncomeSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="월 수입"
      description="매달 들어오는 실수령 금액을 입력해주세요."
    >
      {/* Re-key per open so a canceled edit doesn't leak into the next open. */}
      <MonthlyIncomeForm
        key={open ? "open" : "closed"}
        initialIncome={initialIncome}
        onSaved={() => onOpenChange(false)}
      />
    </BottomSheet>
  );
}

function MonthlyIncomeForm({
  initialIncome,
  onSaved,
}: {
  initialIncome: number;
  onSaved: () => void;
}) {
  const [income, setIncome] = useState(
    initialIncome ? formatAmountInput(String(initialIncome)) : "",
  );
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = parseAmountInput(income);
    startTransition(async () => {
      const result = await saveIncomeAction(parsed);
      if (result.ok) {
        toast.success("월 수입이 저장됐어요.");
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="relative">
        <Input
          inputMode="numeric"
          autoComplete="off"
          aria-label="월 수입"
          value={income}
          onChange={(event) => setIncome(formatAmountInput(event.target.value))}
          placeholder="예: 3,000,000"
          className="h-12 rounded-2xl bg-card pr-10 text-[16px]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground"
        >
          원
        </span>
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-full text-[15px] font-semibold"
      >
        {pending ? "저장 중…" : "저장하기"}
      </Button>
    </form>
  );
}
```

주의: `BottomSheet` props가 위 가정(`open onOpenChange title description children`)과 다르면 `components/ui/bottom-sheet.tsx`를 읽고 맞출 것 (release-notes-popup.tsx:72-77이 실사용 예). `formatAmountInput(String(n))` 시그니처가 string 입력이 아니면 settings-form.tsx:154-155의 초기화 방식을 그대로 따를 것.

- [ ] **Step 5: 브라우저 확인**

`pnpm dev` 후 `/income` 직접 진입 (탭은 아직 없음): 히어로 합계·월 수입 행·추가 수입 리스트·주기 ◀▶ 이동·추가/수정/삭제·월 수입 저장 후 히어로 갱신 확인. 대시보드 예산 숫자에 추가 수입 반영 유지 확인.

- [ ] **Step 6: 검증 + Commit** (사용자 confirm 후)

Run: `pnpm test:run` → PASS.

```bash
git add app/income components/income/income-view.tsx components/income/monthly-income-sheet.tsx app/dashboard/_components/month-switcher.tsx
git commit -m "feat(수입): /income 주기별 수입 화면 추가"
```

---

### Task 3: 하단 navbar 4탭 확장

**Files:**
- Modify: `components/layout/bottom-tab-nav.tsx:5,16-20,38`

**Interfaces:**
- Consumes: Task 2의 `/income` 라우트.
- Produces: 4탭 내비게이션 (소비/고정지출/돈모으기/수입).

- [ ] **Step 1: TABS 배열 + 그리드 수정**

```tsx
import { CalendarDays, HandCoins, Sprout, Wallet } from "lucide-react";
```

```tsx
const TABS: Tab[] = [
  { href: "/dashboard", label: "소비", Icon: Wallet },
  { href: "/fixed-expenses", label: "고정지출", Icon: CalendarDays },
  { href: "/savings", label: "돈모으기", Icon: Sprout },
  { href: "/income", label: "수입", Icon: HandCoins },
];
```

38행 `grid-cols-3` → `grid-cols-4`.

- [ ] **Step 2: 검증 + Commit** (사용자 confirm 후)

브라우저: 4탭 렌더·순서·활성 상태(각 라우트 진입 시 `aria-current`) 확인. `pnpm test:run` → PASS.

```bash
git add components/layout/bottom-tab-nav.tsx
git commit -m "feat(수입): 하단 navbar 4탭 확장 (소비/고정지출/돈모으기/수입)"
```

---

### Task 4: 대시보드 정리 — FAB 단순화 + income-line·롱프레스 가이드 제거

**Files:**
- Modify: `components/transactions/add-transaction-button.tsx` (전면 재작성)
- Modify: `components/dashboard/calendar-day-panel.tsx:642-648` (props 축소)
- Modify: `components/dashboard/spending-summary.tsx` (IncomeLine 제거)
- Modify: `app/dashboard/_sections/spending-summary-section.tsx` (props 축소)
- Modify: `app/dashboard/page.tsx` (items 매핑·props·LongPressGuide 제거)
- Modify: `components/dashboard/release-notes-popup.tsx` (가이드 게이트 제거)
- Modify: `app/settings/page.tsx` (GuideResetButton 제거)
- Delete: `components/income/income-line.tsx`
- Delete: `components/onboarding/long-press-guide.tsx`
- Delete: `components/settings/extras-section.tsx`

**Interfaces:**
- Consumes: 없음 (제거 작업).
- Produces: `AddTransactionButton` 새 시그니처 `{categories: TransactionFormCategory[]; groups?: TransactionFormGroup[]; defaultDate?: string}` — `cycleStart`/`cycleEnd` prop 삭제.

- [ ] **Step 1: FAB 단순화**

`components/transactions/add-transaction-button.tsx` 전체를 아래로 교체 (롱프레스·speed-dial·IncomeFormDialog·motion 제거, 위치·크기·그림자·`data-fab`는 유지):

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import {
  TransactionFormDialog,
  type TransactionFormCategory,
  type TransactionFormGroup,
} from "@/components/transactions/transaction-form-dialog";

type AddTransactionButtonProps = {
  categories: TransactionFormCategory[];
  /** Owner's friend groups (seed + user-defined), forwarded to the form so
   *  the visibility selector can render. Empty until the data loads. */
  groups?: TransactionFormGroup[];
  /** YYYY-MM-DD. Pre-fills the date field when opening in create mode. */
  defaultDate?: string;
};

export function AddTransactionButton({
  categories,
  groups,
  defaultDate,
}: AddTransactionButtonProps) {
  const [transactionOpen, setTransactionOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        data-fab="add-transaction"
        aria-label="소비 추가"
        onClick={() => setTransactionOpen(true)}
        style={{
          right: 24,
          bottom: "calc(76px + env(safe-area-inset-bottom) + 16px)",
          touchAction: "manipulation",
        }}
        className="fixed z-50 flex size-14 items-center justify-center rounded-[28px] bg-primary text-primary-foreground shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition-transform duration-150 ease-out active:scale-95"
      >
        <Plus className="size-6" />
      </button>

      <TransactionFormDialog
        open={transactionOpen}
        onOpenChange={setTransactionOpen}
        categories={categories}
        groups={groups ?? []}
        defaultDate={defaultDate}
      />
    </>
  );
}
```

`components/dashboard/calendar-day-panel.tsx:642-648` 호출부에서 `cycleStart={cycleStart}` / `cycleEnd={cycleEnd}` 두 줄 삭제 (`cycleStart`/`cycleEnd` 변수 자체는 day panel의 다른 로직이 쓰면 유지 — grep으로 확인).

- [ ] **Step 2: spending-summary에서 IncomeLine 제거**

`components/dashboard/spending-summary.tsx`:
- 4행 `import { IncomeLine, ... }` 삭제
- props에서 `extraIncomeItems`(39-45행 주석 포함), `cycleStartDate`(46-47), `cycleEndDate`(48) 삭제 + 구조분해에서 제거
- 450-469행 `hasExtraIncome ? (...) : null` 블록 전체 삭제. `hasExtraIncome` 변수 정의도 다른 사용처 없으면 삭제 (grep 확인). `extraIncome` prop과 예산 계산 반영(`calculateBudgetSummary` 경유)은 **유지**.

`app/dashboard/_sections/spending-summary-section.tsx`:
- props 타입 41-53행 `ownExtraIncomeItems`/`cycleStartDate`/`cycleEndDate` 삭제, 구조분해 111-113행 제거
- 379-381행 `extraIncomeItems=`/`cycleStartDate=`/`cycleEndDate=` 전달 삭제 (`extraIncome={ownExtraIncome ?? 0}`은 유지)

`app/dashboard/page.tsx`:
- 258-263행 `ownExtraIncomeItems` 매핑 삭제, 264-267행 합계는 `.reduce`를 `(ownExtraIncomeRes.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0)`로 교체 (쿼리 select는 `"amount"`만으로 축소, `order` 제거 가능)
- 476-478행 `ownExtraIncomeItems=`/`cycleStartDate=`/`cycleEndDate=` 전달 삭제. `cycleStartDate`/`cycleEndDate` 변수(239-240행)는 income 쿼리가 계속 쓰므로 유지
- `components/income/income-line.tsx` 파일 삭제

- [ ] **Step 3: 롱프레스 가이드 제거**

- `app/dashboard/page.tsx`: 33행 `LongPressGuide` import + 525행 `{lifetimeTxCount > 0 ? <LongPressGuide /> : null}` 삭제. `lifetimeTxCount`는 526행 ReleaseNotesPopup 게이트가 계속 쓰므로 쿼리(182-188행) 유지. 180-181행 주석에서 long-press 언급 갱신 ("release-notes popup 게이트" 취지로).
- `components/dashboard/release-notes-popup.tsx`: 9행 import 삭제, 36-39행 가이드 플래그 게이트(주석 포함) 삭제, 16-23행 JSDoc에서 가이드 언급 제거.
- `app/settings/page.tsx`: `GuideResetButton` import + 119행 사용 삭제.
- 파일 삭제: `components/onboarding/long-press-guide.tsx`, `components/settings/extras-section.tsx`.

- [ ] **Step 4: 잔존 참조 검사**

Run: `grep -rn "IncomeLine\|LongPressGuide\|LONG_PRESS_GUIDE_FLAG\|SPEED_DIAL_EVENT\|GuideResetButton\|IncomeFormDialog" app components --include="*.tsx" --include="*.ts"`
Expected: `IncomeFormDialog`는 `components/income/income-view.tsx`와 `income-form-dialog.tsx` 자신만. 나머지 심볼 0건.

- [ ] **Step 5: 브라우저 확인**

대시보드: FAB 탭 → 소비 폼 열림, 꾹 눌러도 메뉴 없음(컨텍스트 메뉴도 안 뜸), 요약 카드에 추가 수입 줄 없음, 예산 숫자는 추가 수입 반영 유지. 설정: "기능 안내 다시 보기" 버튼 없음.

- [ ] **Step 6: 검증 + Commit** (사용자 confirm 후)

Run: `pnpm test:run` → PASS.

```bash
git add -A components/transactions/add-transaction-button.tsx components/dashboard components/income components/onboarding components/settings/extras-section.tsx app/dashboard app/settings/page.tsx
git commit -m "refactor(대시보드): 수입 표면 제거 — FAB 단순화, income-line·롱프레스 가이드 삭제"
```

---

### Task 5: 설정 정리 — 월 수입 필드 제거

**Files:**
- Modify: `components/settings/settings-form.tsx` (income 상태·핸들러·필드 제거)
- Modify: `app/settings/page.tsx:32,86` (select 축소 + prop 제거)

**Interfaces:**
- Consumes: 없음.
- Produces: `SettingsForm` props에서 `initialIncome` 삭제.

- [ ] **Step 1: settings-form 수정**

`components/settings/settings-form.tsx`에서 삭제:
- 8행 `saveIncomeAction` import (Task 1에서 경로만 바꿔둔 것)
- 33행 `initialIncome: number;` prop + 148행 구조분해
- 154-155행 `income` 상태, 181행 `savedIncome`, 186행 `incomeSave`, 214-218행 `handleIncomeBlur`
- 297-326행 월 수입 필드 블록 (`<div className="space-y-2">`부터 닫는 `</div>`까지). 295행 「예산」 섹션과 328행~ 「돈 들어오는 날」 필드는 유지.
- `formatAmountInput`/`formatNumber`/`parseAmountInput` import 중 다른 사용처 없는 것 정리 (grep 확인 — payday 쪽이 쓸 수 있음).

「예산」 섹션 상단에 수입 탭 안내 한 줄 추가 (필드가 사라진 자리 설명):

```tsx
<p className="text-xs text-muted-foreground">
  월 수입은 하단 수입 탭에서 관리해요.
</p>
```

- [ ] **Step 2: settings/page.tsx 수정**

- 32행 select에서 `monthly_income` 제거 (다른 컬럼 사용처 확인 후)
- 86행 `initialIncome={...}` prop 삭제

- [ ] **Step 3: 검증 + Commit** (사용자 confirm 후)

브라우저: 설정 화면에 월 수입 필드 없음, 닉네임·돈 들어오는 날·알림 등 나머지 필드 정상. `pnpm test:run` → PASS.

```bash
git add components/settings/settings-form.tsx app/settings/page.tsx
git commit -m "refactor(설정): 월 수입 필드 제거 — 수입 탭으로 이동"
```

---

### Task 6: DESIGN.md · CLAUDE.md 개정

**Files:**
- Modify: `DESIGN.md` §6 (3탭 → 4탭), §12에 수입 화면 절 신설, §19 Do/Don't의 탭 관련 문구
- Modify: `CLAUDE.md` (3-tab 언급, income 표면 설명, AppShell `withBottomNav` 목록)

**Interfaces:** 없음 (문서).

- [ ] **Step 1: DESIGN.md 개정**

- §6: 하단 탭을 4탭 `소비(/dashboard) · 고정지출(/fixed-expenses) · 돈모으기(/savings) · 수입(/income)`으로 갱신, "4번째 탭 금지" 문구를 "5번째 탭 금지"로 교체.
- §12에 신규 절 「수입 화면 (/income)」 추가 — 스펙 문서의 화면 구성 블록(히어로 총 수입 = monthly_income + Σ추가수입, 월 수입 행은 현재 주기 전용, 추가 수입 리스트 최신순, 인라인 추가 버튼, 주기 네비게이션은 대시보드와 동일 엔진, 과거 주기 월 수입은 현재 설정값 근사) 반영.
- §12.3/관련 절에서 "FAB 꾹 누르면 수입 추가" 류 문구가 있으면 삭제 (grep `꾹\|롱프레스\|수입 추가`).
- 대시보드 절의 income-line(추가 수입 줄) 언급 삭제.

- [ ] **Step 2: CLAUDE.md 개정**

- Project 개요의 "3 main tabs" → 4 tabs (경로 나열 갱신).
- Domain model의 income 단락에 "수입 표면은 `/income` 탭 단일 (설정·대시보드에서 제거됨), 액션은 `app/income/actions.ts`" 반영.
- Layout primitives의 `withBottomNav` 목록에 `/income` 추가, FAB 설명에서 롱프레스 언급 제거.
- §6 인용 문구(3-tab BottomTabNav) 갱신.

- [ ] **Step 3: Commit** (사용자 confirm 후)

```bash
git add DESIGN.md CLAUDE.md
git commit -m "docs(수입): DESIGN.md·CLAUDE.md 4탭·수입 화면 반영"
```

---

### Task 7: 최종 검증

**Files:** 없음 (검증만).

- [ ] **Step 1: 전체 테스트·빌드**

Run: `pnpm test:run` → 전체 PASS
Run: `pnpm test:utc` → 전체 PASS (주기 엔진 호출 경로 추가에 따른 TZ 회귀 확인)
Run: `pnpm lint` → 에러 0
Run: `pnpm build` → 성공 (타입체크 겸용; `/income` 라우트가 prerender 에러를 내면 Task 2 참고대로 `force-dynamic` 추가)

- [ ] **Step 2: 통합 브라우저 점검**

- 4탭 이동 전부 정상, `/income` 주기 ◀▶ 이동, 추가/수정/삭제, 월 수입 저장.
- 대시보드 예산 카드: 월 수입 변경·추가 수입 등록이 즉시 반영 (revalidatePath("/dashboard") 경유).
- 친구 모드 대시보드: bottom nav 미노출 유지 (수입 노출 경로 없음).
- 온보딩 step 2 (월 수입 입력) 무변경 동작.

- [ ] **Step 3: iOS 실기기 검증 백로그 기록**

컴포넌트 테스트 부재 → 시각·터치 최종 확인은 iOS Safari PWA 실기기 (기존 관행). 배포 후 확인 항목: 4탭 터치 영역, /income 드로어 키보드 인셋, FAB 롱프레스 제거 후 컨텍스트 메뉴 미출현.
