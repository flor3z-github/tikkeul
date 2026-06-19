# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**티끌 (Tikkeul)** — a Korean personal-spending-awareness PWA. Mobile-first, minimal, designed to surface this-month's total + budget rate as fast as possible. UI/UX is governed by `DESIGN.md` (Korean) — read it before changing any visual or interaction surface; the product intentionally excludes bottom nav beyond the 3 main tabs (`/dashboard`, `/savings`, `/fixed-expenses`), Recharts-style charts, income-as-transactions, merchant/payment-method fields on transactions, and offline support.

Stack: Next.js 16 (App Router, Turbopack, React 19) · Supabase (auth + Postgres with RLS) · Tailwind v4 · shadcn/ui (`base-nova`) · Serwist (PWA) · pnpm.

## Target platforms

The app ships exclusively as an installed PWA on two engines:

- **iOS Safari (PWA, added to Home Screen)** — primary target. Mobile Safari quirks apply: `visualViewport` shrinks behind the soft keyboard, the layout viewport scrolls on text-input focus, `100vh` is unreliable (use `100dvh`), `position: fixed` elements need `bottom` rewritten against `visualViewport` when the keyboard is open, and `safe-area-inset-*` must be honored on every bottom-anchored surface.
- **Samsung Internet (PWA, added to Home Screen on Android)** — secondary target. Chromium-based but tracks behind upstream Chrome; assume Chromium feature support, but verify anything newer than 1 year old.

Desktop browsers are **not** a target. When choosing between a desktop-clean implementation and one that survives iOS Safari + Samsung Internet PWA, always pick the latter — even if it adds visualViewport listeners, ResizeObserver hacks, or extra refs. Touch handlers (`onTouchStart`/`onTouchEnd`), `inputMode`, `enterKeyHint`, soft-keyboard-aware positioning, and explicit `focus()` retention after submits are first-class concerns, not edge cases. When a UI change "works on desktop Chrome" that is not evidence it works on the actual target — verify on iOS Safari PWA (or at minimum mobile Chrome with device emulation + touch events) before declaring it done.

The bottom-sheet (`DrawerContent`) and DM chat (`app/dm/[friendId]/_components/dm-chat.tsx`) already encode the visualViewport keyboard pattern — copy from them rather than reinventing.

## Commands

```bash
pnpm dev            # next dev (Turbopack + Serwist SW route)
pnpm build          # next build
pnpm start          # next start
pnpm lint           # eslint (flat config; eslint-config-next core-web-vitals + typescript)
pnpm test           # vitest watch (TZ=Asia/Seoul)
pnpm test:run       # vitest run once (TZ=Asia/Seoul) — the CI-style invocation
pnpm test:utc       # vitest run once under TZ=UTC (catches UTC/KST drift)
pnpm gen:icons      # regenerate /public/icons/{icon-192,icon-512,apple-touch-icon}.png from inline SVG
```

**Run the tests after every change.** The suite is Vitest over the pure `lib/utils/*` functions (date/calendar/payday-cycle/deep-link/payment-day) — `*.test.ts` colocated next to the source. After any edit that touches util logic (or its callers), run `pnpm test:run` and, when the change is date/timezone-sensitive, `pnpm test:utc` as well — several regressions here are TZ-only. When you change a util's behavior, **add or update its `*.test.ts` first** (pin the regression), then make it pass. There is no React component / e2e suite, so for UI-only changes the tests prove "no util regression," not "the screen renders right" — say so and defer visual confirmation to the iOS Safari PWA target. Type-checking still happens via `next build` (or your editor) — there is no separate `tsc` script.

### Required env (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # the sb_publishable_... key, NOT the legacy anon key
```

Optional: `NEXT_DEV_ALLOWED_ORIGINS=192.168.x.y` (comma-separated) to whitelist a LAN origin for `next dev`. Without it, hitting the dev server from a phone on the same Wi-Fi gets a `Blocked cross-origin request to /_next/webpack-hmr` warning and React Refresh fails to hydrate, so client `onClick` handlers never attach. The value is read by `next.config.ts` and ignored in prod.

### Database

Migrations live in `supabase/migrations/` (run in order via the Supabase SQL Editor). `0001_init.sql` creates schema + the `auth.users → profiles` trigger; `0002_rls.sql` enables RLS and per-user policies; `0003_seed_categories.sql` seeds shared categories with `user_id IS NULL`; `0004_remove_subscription_category.sql` drops 구독 (treated as fixed expense).

Later migrations layer in fixed expenses (`0005`–`0014`, `0021`, `0024`–`0030` — `subscription_plans` catalog with `aliases text[]`, `fixed_expenses` with optional `plan_name`, repeated catalog reshuffles), soft delete (`0015_soft_delete_transactions.sql` adds `transactions.deleted_at`; every read filters `.is("deleted_at", null)`), the optional memo column (`0016_add_memo_to_transactions.sql`, max 100 chars), nicknames (`0017_seed_random_nicknames.sql` populates `profiles.display_name` via a Korean adjective+noun+4-digit trigger), the friend system (`0018_friend_codes_and_friendships.sql`, `0019_friendship_view_policies.sql`, `0023_get_user_cycle_rpc.sql`), realtime publication (`0020_realtime_transactions.sql` adds `transactions` to `supabase_realtime` with `replica identity full`), and the budget cycle columns (`0022_user_settings_budget_cycle.sql` adds `cycle_mode` + `cycle_start_day`). The **Model B budget-cycle rebuild** then layers on three timestamp-numbered migrations: `20260512100047_holidays.sql` (public `holidays` lookup table, authenticated SELECT only, seeded with 2026 KR public holidays), `20260512100048_user_settings_payday_payroll_rule.sql` (adds `payday smallint` `0=말일`/`1..28` default 1 + `payroll_rule text` `prev|same|next` default `prev`, with an in-transaction lossy backfill from `cycle_mode`/`cycle_start_day` — `calendar` rows all become `payday=1`), and `20260512100049_get_user_cycle_payday.sql` (drops + recreates `get_user_cycle` to return `(payday, payroll_rule)`). `cycle_mode`/`cycle_start_day` are deprecated-preserved (no longer read). Deployment order is M1→M2→code→M3 because M3 changes the RPC return signature. Holidays must be re-seeded annually.

`lib/supabase/database.types.ts` is hand-written. Replace it with `supabase gen types` output if the schema grows further.

## Architecture

### Auth & routing

- **`proxy.ts` (project root) is the Next.js 16 middleware** — Next 16 renamed `middleware.ts` to `proxy.ts`. It delegates to `lib/supabase/middleware.ts::updateSession`, which refreshes the Supabase session cookie and redirects:
  - signed-out user on a non-public path → `/login?redirectTo=...`
  - signed-in user on `/login` or `/signup` → `/dashboard`
- Public paths: `/login`, `/signup`, `/auth`, `/offline`.
- The matcher excludes `_next/*`, static assets, **and the Serwist routes** (`/serwist`, `/sw.js`, `/workbox-*`, `/manifest.webmanifest`) — keep this list in sync when adding new public endpoints.
- `app/page.tsx` is a server-side redirect: signed in → `/dashboard`, else `/login`. There is no landing page.
- Authenticated routes today: `/dashboard`, `/fixed-expenses`, `/friends`, `/settings`. `/friends` (server actions in `app/friends/actions.ts`) handles friend code issue/redeem and the friend list — the friend pairing entry point is the nickname section of `/settings`, not the bottom tabs.

### Supabase clients (do not collapse into one)

- `lib/supabase/server.ts` — `createServerClient` bound to `next/headers` cookies. Use in Server Components and Server Actions.
- `lib/supabase/client.ts` — `createBrowserClient` for `"use client"` code.
- `lib/supabase/middleware.ts` — request-scoped client used only by `proxy.ts`.

Per the Supabase SSR guide notes in `server.ts`/`middleware.ts`: do **not** hoist these into module-level globals (Fluid Compute), and do **not** insert work between `createServerClient(...)` and the first `getClaims`/`getUser()` call in the middleware — auth cookies must round-trip atomically or users will be randomly logged out.

### Data flow

- Pages are React Server Components that read from Supabase directly (`createClient()` → query). Most use `export const dynamic = "force-dynamic"` because they depend on the session cookie.
- Mutations go through **Server Actions** colocated under the route (`app/dashboard/actions.ts`, `app/settings/actions.ts`, `app/login/actions.ts`). Actions call `revalidatePath` and return `{ ok: true } | { ok: false; error }` (or `redirect` for auth). Clients dispatch via `useTransition` / `useActionState`.
- RLS does the authorization — server actions still call `supabase.auth.getUser()` and `redirect("/login")` if absent, but every query/mutation is also fenced by `auth.uid() = user_id` policies in `supabase/migrations/0002_rls.sql`.

### Domain model

- `transactions` are **spending only**. The product does not record income as transactions; income lives on `user_settings.monthly_income`. Don't add income flows without revisiting `DESIGN.md`.
- `transactions` use **soft delete** via `deleted_at timestamptz`. Every read query (`app/dashboard/actions.ts`, anything reading transactions) must add `.is("deleted_at", null)`. The UI presents delete as a hard delete — only the destructive button inside the edit form, gated by `AlertDialog`. Don't expose a trash/restore UI.
- `transactions` may carry an **optional memo** (`text`, max 100 chars, server normalizes empty/whitespace to `null`). The form has 3 core fields + memo; transaction items render the memo on a second line under the category name when present. Still no merchant/payment-method.
- Budget math lives in `lib/utils/budget.ts`: `totalSpent = fixedExpense + monthlyExpense`, `remainingBudget = monthlyIncome − totalSpent`, `spendingRate = totalSpent / monthlyIncome × 100`. `availableBudget = monthlyIncome − fixedExpense` is still computed (used by fixed-expense surfaces) but the dashboard summary card no longer renders it directly. Status thresholds: `normal < 60 ≤ caution < 90 ≤ warning < 100 ≤ over`. Reuse `calculateBudgetSummary` / `getSpendingStatus` — don't reimplement.
- **Budget cycle (Model B — paycheck-deposit anchor)**: the user is only ever asked **when money comes in** (label reads `돈 들어오는 날` — deliberately persona-neutral covering 월급/용돈/입금, *not* the salaried-only `월급날`; settings has a single Select: `1일`~`28일` + `말일`) **plus a `급여 규정` Select** (이전 영업일=`prev` default / 당일=`same` / 다음 영업일=`next`). These map to two `user_settings` columns: `payday smallint` (`0=말일`, reusing the `payment-day.ts` `0=말일` convention; `1..28`=that day; default 1) and `payroll_rule text` (`prev|same|next`, default `prev`). The cycle is **anchored to the predicted paycheck deposit date**, not a stored calendar/income_day mode. Engine = pure functions in `lib/utils/payday-cycle.ts`: `isBusinessDay` (not Sat/Sun and not in the holidays table), `adjustToBusinessDay(date, rule, holidays)` (prev=walk back / next=walk forward / same=unchanged), `resolveDeposit` (nominal day → adjusted deposit), `resolveAnchor` (anchor = the deposit day itself for **every** payday incl. 말일 — the cycle is `[payday, next payday)` so the deposit day is day 1 of the cycle its paycheck funds; the old 말일 deposit+1 snap was removed because it pushed the deposit day out of the funded cycle), `getCycleRangeB(payday, rule, holidays, nominalMonth, now?)` (cycle = `[anchor(M), anchor(M+1))`), and `resolveDashboardParamsB` (drop-in for the old `resolveDashboardParams`, does the label↔nominal month round-trip). **Label month** = deposit month as-is for `1`/`2~28`, **+1 month for `말일`** (e.g. Jan 말일 deposit → labeled `2월`). Cycle boundaries genuinely move — a Jan cycle can start `12/31` of the prior year (verified 2026 `prev`: `payday=1` Jan → `[2025-12-31, 2026-01-30)` '1월'; `payday=20` → `[1/20, 2/20)`; `말일` → `[1/30, 2/27)` '2월'). **`cycleMode` is now DERIVED** (`calendar` only when the cycle equals exactly `[1st, 1st-of-next-month)`, else `income_day`) purely for **grid-shape** switching (7×6 calendar matrix vs variable cycle rows) — the **displayed label is NOT derived from it** (see below), and there is no longer a stored mode used for resolution; the `cycle_mode`/`cycle_start_day` columns are **deprecated-preserved** (kept for rollback, no longer read). Holidays live in a Supabase `holidays` table (col `d date` PK + `name text`, authenticated read / SQL-editor-only writes); `lib/queries/holidays.ts::getHolidays(yearStart, yearEnd, client?)` returns a `Set<string>` of `YYYY-MM-DD` (stored verbatim, no `new Date()` round-trip → no UTC/KST drift), and `holidayRangeForAnchor` loads ±1 year since cycles cross year boundaries. **Holidays must be seeded/updated annually** (insert each year's public holidays via the SQL editor). The payday-code↔DB mapping (`1`..`28`|`last` ⇄ `payday` `0`=말일/`1..28`) is done **inline** in the two consumers — `components/settings/settings-form.tsx` (`groupForPayday` + a `paydayDb` memo, then calls `saveCycleAction(payday, payroll_rule)` directly, no hidden inputs) and `app/onboarding/_components/onboarding-flow.tsx`. (The old shared `paydayCodeToDb`/`dbToPaydayCode`/`PAYDAY_OPTIONS` helpers in `calendar.ts` were removed as orphans; if a third consumer appears, reinstate a single shared mapper rather than a third inline copy.) `get_user_cycle(target)` RPC now returns `(payday, payroll_rule)` (not `cycle_mode`/`cycle_start_day`); **friend cycles are computed in JS** from those two fields + the public holidays via the same engine — `monthly_income` is still never exposed. Migrations `20260512100047_holidays.sql`/`20260512100048_user_settings_payday_payroll_rule.sql`/`20260512100049_get_user_cycle_payday.sql`. **Lossy backfill (intentional)**: pre-existing `calendar` rows (which absorbed both 1일 and 말일 payers) all become `payday=1`, so real 말일 payers surface as `1일` and must re-select 말일 in settings; legacy `income_day` 2~28 → `payday=N`, 29~31 → `payday=0`. The legacy `getCycleRange`/`resolveDashboardParams`/`clampDayToMonth` stay in `calendar.ts` as `@deprecated` (zero callers after the migration, kept as a rollback surface). `spending-month-grid.tsx` switches on the derived `cycleMode` for **grid shape only** (7×6 calendar vs variable cycle rows). The **displayed label is chosen by `payday`, not `cycleMode`** (set in `getCycleRangeB`): `1일`/`말일` → 「N월」 (말일 = next month) **even when the cycle is shifted off the calendar month** — a `payday=1` `12/31–1/30` cycle shows 「1월」 while its grid correctly starts on the 31st; `2~28` → the `M/D – M/D` range. So the header label never flips for `1일`/`말일` payers (only the grid's first day shifts), which is the intended UX.
- `categories` rows with `user_id IS NULL` are **shared seeds** visible to every user (RLS allows it); non-null rows are **per-user customs** (implemented). `lib/queries/categories.ts::getCategories(userId)` merges both via `.or("user_id.is.null,user_id.eq.<uid>")`, filters `HIDDEN_CATEGORIES` (구독), and sorts seeds by `CATEGORY_ORDER` then customs (created_at asc, keyed on `user_id !== null` — never by name, since a custom may share a seed name). **Custom CRUD lives in one place**: the category picker drawer (`components/transactions/category-picker-drawer.tsx`) opened from the transaction form's category row — select mode + edit mode toggle, list↔form internal view switching (no 3rd nested vaul drawer). Server actions `createCategoryAction`/`updateCategoryAction`/`deleteCategoryAction` in `app/dashboard/actions.ts` (name 1–10 trim, icon allowlist + color palette validated server-side, 20-cap on create, friendly duplicate-name message). **Delete reassigns** that category's transactions to the 기타 seed (not null/미분류) via the `delete_category(p_id)` SECURITY DEFINER RPC, then deletes the row. The unique index is `(user_id, name)` and the only DB CHECK is name length 1–10 (icon/color stay app-side). There's no `/settings/categories` route — the picker drawer is the sole management surface.
- **Friend-mode category exposure**: friend RLS hides the owner's custom category rows, so the `categories(...)` join in `getMonthlyTransactions` returns null for transactions tagged with a custom category. `lib/queries/transactions.ts` backfills those rows (category_id set but category_name null) via the `get_user_categories(target)` SECURITY DEFINER RPC, which returns only `{id,name,icon,color}` for the target's customs and gates on `target = auth.uid()` OR an accepted friendship. In own mode no row has a null name, so the backfill branch never fires (natural gate, single round-trip).
- Category icon slugs map to lucide icons in `lib/utils/category-icon.tsx`. Seed/legacy slugs: `utensils`, `coffee`, `wine`, `shopping-bag`, `car`, `home`, `heart-pulse`, `heart-handshake`, `film`, `plane`, `gift`, `more-horizontal` (catch-all), `repeat`. Custom-picker icons add: `dumbbell`, `book`, `gamepad-2`, `paw-print`, `baby`, `shirt`, `smartphone`, `fuel`, `bus-front`, `sparkles`, `hand-coins`, `piggy-bank`. The legacy `bus` slug is aliased to the `Car` icon so historical rows still render (the new dedicated bus icon is `bus-front`). `CATEGORY_ICON_SLUGS` (24 meaningful slugs, ordered) and `CATEGORY_COLORS` (fixed palette) are the picker's options and the server-action allowlists. When you add a seed category, add its slug there too.
- **Friend system**: `/friends` issues a 6-char code (`lib/utils/friend-code.ts`, ALPHABET excludes `0/O/1/I`, `FRIEND_CODE_TTL_MINUTES = 10`, single-use, issuing a new one expires the previous active one) and accepts a code via `redeemFriendCodeAction` (rate-limited 5/min by `redeem_attempts`, then calls the `redeem_friend_code(text)` SECURITY DEFINER RPC which `for update`-locks the code, atomically inserts both directions of `friendships`, and returns one of `ok` / `invalid` / `self` / `unauthenticated`). Friend SELECT on `transactions`/`profiles` is enabled by `0019_friendship_view_policies.sql`; `user_settings` is **never** exposed to friends. Friend-mode dashboard is `/dashboard?viewing=<friendId>` with UUID validation + friendship check; the cycle is fetched via `get_user_cycle(target uuid)` SECURITY DEFINER which only returns `cycle_mode` and `cycle_start_day` (never `monthly_income`). When in friend mode, the summary card hides available-budget / spending-rate / progress and shows total spending only with the copy "친구의 수입·고정지출·예산은 비공개예요." Bottom nav and the FAB are also hidden via `withBottomNav={isOwn} withFab={isOwn}`.
- **Nicknames**: `profiles.display_name`. The `handle_new_user` trigger seeds Korean adjective+noun+4-digit nicknames automatically. Editable in Settings (`lib/utils/nickname.ts::NICKNAME_MAX_LENGTH = 20`, no whitespace/tab/newline). Friend list and `FriendSwitcher` fall back to "이름 없음" when display_name is empty; the viewer's own row shows "{nickname} (나)".
- **Realtime**: `transactions` (and `dm_messages`) are in the `supabase_realtime` publication with `replica identity full` so client-side `user_id=eq.<friendId>` filters survive UPDATE/DELETE. `components/dashboard/dashboard-realtime-watcher.tsx` mounts on the dashboard in **both** modes: in **friend mode** it subscribes to the friend's `transactions` (channel `friend-tx:<friendId>`) and debounces 300 ms → `router.refresh()`; in **own mode** it instead watches `dm_messages` for incoming DMs (channel `own-dm:<ownerUserId>`; toast + unread-dot refresh) and never the owner's own transactions (own mutations revalidate via their server action).
- Money/date helpers live in `lib/utils/money.ts` and `lib/utils/date.ts` — use `formatKRW`, `formatNumber`, `parseAmountInput`, `monthStart`/`monthEnd`, `toISODate`, `formatRelativeKoreanDate`. Don't introduce `Intl.NumberFormat` ad-hoc.

### PWA / Service Worker

- `app/sw.ts` is the Serwist worker; `app/serwist/[path]/route.ts` (via `@serwist/turbopack`) serves it. `app/serwist.tsx` re-exports the client provider, mounted in `app/layout.tsx`.
- **Cache policy is intentionally narrow.** Precache: the Next-emitted manifest (HTML/CSS/JS shell + icons). Runtime: every request matching `*.supabase.co` or paths starting with `/rest/v1/`, `/auth/v1/`, `/storage/v1/`, `/realtime/v1/` is forced to `NetworkOnly`. **Never** add private spending data, auth tokens, REST responses, realtime payloads, storage objects, or any **friend** data to Cache Storage — friend transactions/profiles flow over the same Supabase endpoints and inherit the same NetworkOnly rule. There is no offline fallback by design (`DESIGN.md §16`).
- `app/sw.ts` is excluded from the main `tsconfig.json` because Serwist compiles it with its own worker-typed config.
- `app/manifest.ts` is the PWA manifest (file-based, served at `/manifest.webmanifest`). `pnpm gen:icons` writes 192/512/180 PNGs into `public/icons/`.

### Styling

- Tailwind v4 with **CSS-first config** — there is no `tailwind.config.ts`. Tokens (colors, radii, fonts) are declared as CSS variables in `app/globals.css` under `:root` / `.dark` and exposed to Tailwind via the `@theme inline { ... }` block. Add new design tokens there, not in JS config.
- Dark mode is class-based via `@custom-variant dark (&:is(.dark *))`. `next-themes` is in deps but no provider is wired yet — light is the only mode in use today.
- Pretendard is loaded by `@import "pretendard/dist/web/variable/..."` in `globals.css`. `DESIGN.md` shows a `@fontsource/pretendard` path — that's outdated; the `pretendard` package is what's actually installed.
- shadcn config (`components.json`): style `base-nova`, RSC on, icons `lucide`, aliases `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`. Use `cn()` from `@/lib/utils` for class merging.

### Layout primitives

- `components/layout/app-shell.tsx` is the single mobile container (`min-h-dvh`, `max-w-md`, `px-5 pb-28 pt-4`). Every page should wrap content in `<AppShell>`. Pass `withBottomNav` for `/dashboard` (own-mode only) and `/fixed-expenses`; omit it on `/settings` and `/friends`. Pass `withFab` only on the own-mode dashboard — friend mode hides both.
- `components/layout/header.tsx` is `<PageHeader eyebrow title trailing />`. The dashboard `trailing` slot mounts `<FriendSwitcher>` (sheet to swap viewer between self and friends) and the settings link, in that order.
- The add-transaction FAB (`components/transactions/add-transaction-button.tsx`) is positioned with `bottom: max(24px, env(safe-area-inset-bottom))` — preserve that when modifying.
- **Add and edit reuse the same `TransactionFormDialog`** (`components/transactions/transaction-form-dialog.tsx`) keyed by `initial?.id`. Pass `initial` to enter edit mode; omit it to create. Don't fork a second form.
- **Bottom sheets must use `DrawerContent`** from `components/ui/drawer.tsx` — never call vaul's `<DrawerPrimitive.Content>` directly and never replicate sheet markup elsewhere. The shared component owns iOS soft-keyboard handling (visualViewport `resize`+`scroll` listeners, `bottom`/`maxHeight`/`paddingBottom` rewrites, an inner `overflow-y-auto` scroller) for two specific Mobile Safari quirks: visualViewport shrinking behind the keyboard, and the layout viewport scrolling on text-input focus. Each line in `DrawerContent` addresses a real failure mode — read the comments before "simplifying."

## DESIGN.md is the visual contract

`DESIGN.md` (Korean, ~22 sections) defines color tokens, type scale, radii, spacing, surfaces, motion, shadcn usage, screen guidelines (dashboard / add-edit / settings / calendar-MVP1.5), forms, accessibility, and the Do/Don't list. Before designing or restyling any screen, read the relevant section. In particular:

- §3 핵심 숫자 우선 — this-month total + rate are the largest elements on the dashboard.
- §6 Mobile-first single-column, `max-w-md` even on desktop. The bottom tab nav is the **3-tab** `BottomTabNav` (`/dashboard` 소비, `/savings` 돈모으기, `/fixed-expenses` 고정지출) — don't add a fourth tab.
- §9 shadcn — Button/Card/Input/Sheet/Popover/Calendar/Sonner allowed; complex Tabs and Recharts-style charts disallowed.
- §12.3 The transaction form has three core fields (category, amount, date) plus an optional memo (max 100 chars). No merchant/payment-method. Delete is a soft delete via `transactions.deleted_at`, exposed only inside the edit form's destructive button (with `AlertDialog` confirmation).
- §12.8 **Friends** — pairing UI is `/friends`; the friend-mode dashboard hides budget/rate and surfaces only the friend's spending and per-day flow.
- §16 PWA cache rules — see Service Worker section above. Friend traffic and realtime payloads are NetworkOnly too.
- §19 Do/Don't — no Recharts, no Apple UI mimicry, no caching private or friend data, no exposing `monthly_income` (or anything derived from it) when viewing a friend.

If a request conflicts with `DESIGN.md`, surface the conflict to the user rather than silently overriding.

## Conventions

- Imports use the `@/*` path alias (e.g. `@/lib/supabase/server`, `@/components/ui/button`). Don't introduce relative `../../..` chains.
- Server Actions return `{ ok: true } | { ok: false; error: string }` (or `redirect`) — match this shape when adding new actions and surface failures via `sonner` toasts on the client.
- Currency is always KRW integers (`numeric` in Postgres, `Number` in TS, no decimals in the UI). Amount inputs use `inputMode="numeric"` and `parseAmountInput` to strip commas before `parseInt`.
- Korean copy for all user-facing strings; comments and identifiers in English.
- `randomUUID()` is generated server-side (see `app/dashboard/actions.ts`) — `transactions.id` is required, not defaulted by the DB.

### Delegating to subagents

**Default to delegating — reach for agents across all three phases (investigate → build → verify), not just big refactors.** Keeping search/read-heavy work off the main thread preserves its context, and the caveman agents return token-compressed output. Use the main thread for orchestration, decisions, and the final synthesis; push the legwork down.

- **Investigate** — "where is X / what calls Y / map this dir" → `caveman:cavecrew-investigator` (read-only locator, returns a `file:line` table). For broad multi-location sweeps where you only need the conclusion, use `Explore`.
- **Build** — a bounded 1–2 file edit → `caveman:cavecrew-investigator` (locate exact `file:line`) **then** `caveman:cavecrew-builder` (apply), run sequentially so the editor consumes the locator's findings. Don't send the builder a 3+ file scope — split it or do it on the main thread.
- **Verify** — review a diff/branch/file → `caveman:cavecrew-reviewer` (one finding per line, severity-tagged). Running the test suite (`pnpm test:run`) is the main thread's job, not an agent's.

**Fallbacks:** if the caveman agents aren't available in this environment, use the generic `general-purpose` Agent for the locate/edit/review roles. When a step needs MCP tools the caveman agents lack (e.g. context7 docs lookups), use a full-tools agent (`general-purpose`/`claude`) for that step. Run independent agents in parallel (one message, multiple Agent calls); chain them only when a later step consumes an earlier one's output.
