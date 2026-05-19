# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**티끌 (Tikkeul)** — a Korean personal-spending-awareness PWA. Mobile-first, minimal, designed to surface this-month's total + budget rate as fast as possible. UI/UX is governed by `DESIGN.md` (Korean) — read it before changing any visual or interaction surface; the product intentionally excludes bottom nav beyond the 2 main tabs (`/dashboard`, `/fixed-expenses`), Recharts-style charts, income-as-transactions, merchant/payment-method fields on transactions, and offline support.

Stack: Next.js 16 (App Router, Turbopack, React 19) · Supabase (auth + Postgres with RLS) · Tailwind v4 · shadcn/ui (`base-nova`) · Serwist (PWA) · pnpm.

## Commands

```bash
pnpm dev            # next dev (Turbopack + Serwist SW route)
pnpm build          # next build
pnpm start          # next start
pnpm lint           # eslint (flat config; eslint-config-next core-web-vitals + typescript)
pnpm gen:icons      # regenerate /public/icons/{icon-192,icon-512,apple-touch-icon}.png from inline SVG
```

There is no test suite. Type-checking happens via `next build` (or your editor) — there is no separate `tsc` script.

### Required env (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # the sb_publishable_... key, NOT the legacy anon key
```

Optional: `NEXT_DEV_ALLOWED_ORIGINS=192.168.x.y` (comma-separated) to whitelist a LAN origin for `next dev`. Without it, hitting the dev server from a phone on the same Wi-Fi gets a `Blocked cross-origin request to /_next/webpack-hmr` warning and React Refresh fails to hydrate, so client `onClick` handlers never attach. The value is read by `next.config.ts` and ignored in prod.

### Database

Migrations live in `supabase/migrations/` (run in order via the Supabase SQL Editor). `0001_init.sql` creates schema + the `auth.users → profiles` trigger; `0002_rls.sql` enables RLS and per-user policies; `0003_seed_categories.sql` seeds shared categories with `user_id IS NULL`; `0004_remove_subscription_category.sql` drops 구독 (treated as fixed expense).

Later migrations layer in fixed expenses (`0005`–`0014`, `0021`, `0024`–`0030` — `subscription_plans` catalog with `aliases text[]`, `fixed_expenses` with optional `plan_name`, repeated catalog reshuffles), soft delete (`0015_soft_delete_transactions.sql` adds `transactions.deleted_at`; every read filters `.is("deleted_at", null)`), the optional memo column (`0016_add_memo_to_transactions.sql`, max 100 chars), nicknames (`0017_seed_random_nicknames.sql` populates `profiles.display_name` via a Korean adjective+noun+4-digit trigger), the friend system (`0018_friend_codes_and_friendships.sql`, `0019_friendship_view_policies.sql`, `0023_get_user_cycle_rpc.sql`), realtime publication (`0020_realtime_transactions.sql` adds `transactions` to `supabase_realtime` with `replica identity full`), and the budget cycle columns (`0022_user_settings_budget_cycle.sql` adds `cycle_mode` + `cycle_start_day`).

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
- **Budget cycle** has two modes on `user_settings`: `cycle_mode = 'calendar'` (default, month-of-year) and `cycle_mode = 'income_day'` (cycle starts on `cycle_start_day` 1–31, clamped to month length). The dashboard reads both, the calendar grid is fixed 7×6 in calendar mode and a variable-row grid in income_day mode, and the MonthSwitcher label switches between `5월` and `5/20 – 6/19`.
- `categories` rows with `user_id IS NULL` are **shared seeds** visible to every user (RLS allows it); non-null rows are per-user customs (future). The dashboard merges both via `.or("user_id.is.null,user_id.eq.<uid>")` and applies `CATEGORY_ORDER` + `HIDDEN_CATEGORIES` in `app/dashboard/page.tsx`.
- Category icon slugs (`utensils`, `coffee`, `bus`, `shopping-bag`, `home`, `heart-pulse`, `more-horizontal`) map to lucide icons in `lib/utils/category-icon.tsx`. When you add a seed category, add its slug there too.
- **Friend system**: `/friends` issues a 6-char code (`lib/utils/friend-code.ts`, ALPHABET excludes `0/O/1/I`, `FRIEND_CODE_TTL_MINUTES = 10`, single-use, issuing a new one expires the previous active one) and accepts a code via `redeemFriendCodeAction` (rate-limited 5/min by `redeem_attempts`, then calls the `redeem_friend_code(text)` SECURITY DEFINER RPC which `for update`-locks the code, atomically inserts both directions of `friendships`, and returns one of `ok` / `invalid` / `self` / `unauthenticated`). Friend SELECT on `transactions`/`profiles` is enabled by `0019_friendship_view_policies.sql`; `user_settings` is **never** exposed to friends. Friend-mode dashboard is `/dashboard?viewing=<friendId>` with UUID validation + friendship check; the cycle is fetched via `get_user_cycle(target uuid)` SECURITY DEFINER which only returns `cycle_mode` and `cycle_start_day` (never `monthly_income`). When in friend mode, the summary card hides available-budget / spending-rate / progress and shows total spending only with the copy "친구의 수입·고정지출·예산은 비공개예요." Bottom nav and the FAB are also hidden via `withBottomNav={isOwn} withFab={isOwn}`.
- **Nicknames**: `profiles.display_name`. The `handle_new_user` trigger seeds Korean adjective+noun+4-digit nicknames automatically. Editable in Settings (`lib/utils/nickname.ts::NICKNAME_MAX_LENGTH = 20`, no whitespace/tab/newline). Friend list and `FriendSwitcher` fall back to "이름 없음" when display_name is empty; the viewer's own row shows "{nickname} (나)".
- **Realtime**: only `transactions` is in the `supabase_realtime` publication and uses `replica identity full` so client-side `user_id=eq.<friendId>` filters survive UPDATE/DELETE. `components/dashboard/friend-realtime-watcher.tsx` mounts only in friend mode, subscribes to channel `friend-tx:<friendId>`, and on any postgres_changes event debounces 300 ms then calls `router.refresh()`. Never subscribe in own-mode.
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
- §6 Mobile-first single-column, `max-w-md` even on desktop. The bottom tab nav is the **2-tab** `BottomTabNav` (`/dashboard`, `/fixed-expenses`) only — never add a third tab.
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
