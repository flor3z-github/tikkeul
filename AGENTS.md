# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

**티끌 (Tikkeul)** — a Korean personal-spending-awareness PWA. Mobile-first, minimal, designed to surface this-month's total + budget rate as fast as possible. UI/UX is governed by `DESIGN.md` (Korean) — read it before changing any visual or interaction surface; the MVP intentionally excludes bottom nav, charts, income-as-transactions, memo/merchant fields, and offline support.

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

### Database

Migrations live in `supabase/migrations/` (run in order via the Supabase SQL Editor). `0001_init.sql` creates schema + the `auth.users → profiles` trigger; `0002_rls.sql` enables RLS and per-user policies; `0003_seed_categories.sql` seeds shared categories with `user_id IS NULL`; `0004_remove_subscription_category.sql` drops 구독 (treated as fixed expense).

`lib/supabase/database.types.ts` is hand-written for the MVP. Replace it with `supabase gen types` output if the schema grows.

## Architecture

### Auth & routing

- **`proxy.ts` (project root) is the Next.js 16 middleware** — Next 16 renamed `middleware.ts` to `proxy.ts`. It delegates to `lib/supabase/middleware.ts::updateSession`, which refreshes the Supabase session cookie and redirects:
  - signed-out user on a non-public path → `/login?redirectTo=...`
  - signed-in user on `/login` or `/signup` → `/dashboard`
- Public paths: `/login`, `/signup`, `/auth`, `/offline`.
- The matcher excludes `_next/*`, static assets, **and the Serwist routes** (`/serwist`, `/sw.js`, `/workbox-*`, `/manifest.webmanifest`) — keep this list in sync when adding new public endpoints.
- `app/page.tsx` is a server-side redirect: signed in → `/dashboard`, else `/login`. There is no landing page.

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

- `transactions` are **spending only**. The MVP does not record income as transactions; income lives on `user_settings.monthly_income`. Don't add income flows without revisiting `DESIGN.md`.
- Budget math lives in `lib/utils/budget.ts`: `availableBudget = monthlyIncome − fixedExpense`, `spendingRate = monthlyExpense / availableBudget × 100`. Status thresholds: `normal < 60 ≤ caution < 90 ≤ warning < 100 ≤ over`. Reuse `calculateBudgetSummary` / `getSpendingStatus` — don't reimplement.
- `categories` rows with `user_id IS NULL` are **shared seeds** visible to every user (RLS allows it); non-null rows are per-user customs (future). The dashboard merges both via `.or("user_id.is.null,user_id.eq.<uid>")` and applies `CATEGORY_ORDER` + `HIDDEN_CATEGORIES` in `app/dashboard/page.tsx`.
- Category icon slugs (`utensils`, `coffee`, `bus`, `shopping-bag`, `home`, `heart-pulse`, `more-horizontal`) map to lucide icons in `lib/utils/category-icon.tsx`. When you add a seed category, add its slug there too.
- Money/date helpers live in `lib/utils/money.ts` and `lib/utils/date.ts` — use `formatKRW`, `formatNumber`, `parseAmountInput`, `monthStart`/`monthEnd`, `toISODate`, `formatRelativeKoreanDate`. Don't introduce `Intl.NumberFormat` ad-hoc.

### PWA / Service Worker

- `app/sw.ts` is the Serwist worker; `app/serwist/[path]/route.ts` (via `@serwist/turbopack`) serves it. `app/serwist.tsx` re-exports the client provider, mounted in `app/layout.tsx`.
- **Cache policy is intentionally narrow.** Precache: the Next-emitted manifest (HTML/CSS/JS shell + icons). Runtime: every request matching `*.supabase.co` or paths starting with `/rest/v1/`, `/auth/v1/`, `/storage/v1/`, `/realtime/v1/` is forced to `NetworkOnly`. **Never** add private spending data, auth tokens, or REST responses to Cache Storage. There is no offline fallback by design (`DESIGN.md §16`).
- `app/sw.ts` is excluded from the main `tsconfig.json` because Serwist compiles it with its own worker-typed config.
- `app/manifest.ts` is the PWA manifest (file-based, served at `/manifest.webmanifest`). `pnpm gen:icons` writes 192/512/180 PNGs into `public/icons/`.

### Styling

- Tailwind v4 with **CSS-first config** — there is no `tailwind.config.ts`. Tokens (colors, radii, fonts) are declared as CSS variables in `app/globals.css` under `:root` / `.dark` and exposed to Tailwind via the `@theme inline { ... }` block. Add new design tokens there, not in JS config.
- Dark mode is class-based via `@custom-variant dark (&:is(.dark *))`. `next-themes` is in deps but no provider is wired yet — light is the only mode in use today.
- Pretendard is loaded by `@import "pretendard/dist/web/variable/..."` in `globals.css`. `DESIGN.md` shows a `@fontsource/pretendard` path — that's outdated; the `pretendard` package is what's actually installed.
- shadcn config (`components.json`): style `base-nova`, RSC on, icons `lucide`, aliases `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`. Use `cn()` from `@/lib/utils` for class merging.

### Layout primitives

- `components/layout/app-shell.tsx` is the single mobile container (`min-h-dvh`, `max-w-md`, `px-5 pb-28 pt-4`). Every page should wrap content in `<AppShell>`.
- `components/layout/header.tsx` is `<PageHeader eyebrow title trailing />`. No bottom nav exists or should be added in the MVP.
- The add-transaction FAB (`components/transactions/add-transaction-button.tsx`) is positioned with `bottom: max(24px, env(safe-area-inset-bottom))` — preserve that when modifying.
- **Add and edit reuse the same `TransactionFormDialog`** (`components/transactions/transaction-form-dialog.tsx`) keyed by `initial?.id`. Pass `initial` to enter edit mode; omit it to create. Don't fork a second form.

## DESIGN.md is the visual contract

`DESIGN.md` (Korean, ~22 sections) defines color tokens, type scale, radii, spacing, surfaces, motion, shadcn usage, screen guidelines (dashboard / add-edit / settings / calendar-MVP1.5), forms, accessibility, and the Do/Don't list. Before designing or restyling any screen, read the relevant section. In particular:

- §3 핵심 숫자 우선 — this-month total + rate are the largest elements on the dashboard.
- §6 Mobile-first single-column, `max-w-md` even on desktop. No bottom tab nav.
- §9 shadcn — Button/Card/Input/Sheet/Popover/Calendar/Sonner allowed; Tabs/Bottom Nav/Charts disallowed in MVP.
- §12.3 The transaction form has exactly three fields: category, amount, date. No memo/merchant/payment-method. Delete is intentionally absent.
- §16 PWA cache rules — see Service Worker section above.
- §19 Do/Don't — no Recharts, no Apple UI mimicry, no caching private data.

If a request conflicts with `DESIGN.md`, surface the conflict to the user rather than silently overriding.

## Conventions

- Imports use the `@/*` path alias (e.g. `@/lib/supabase/server`, `@/components/ui/button`). Don't introduce relative `../../..` chains.
- Server Actions return `{ ok: true } | { ok: false; error: string }` (or `redirect`) — match this shape when adding new actions and surface failures via `sonner` toasts on the client.
- Currency is always KRW integers (`numeric` in Postgres, `Number` in TS, no decimals in the UI). Amount inputs use `inputMode="numeric"` and `parseAmountInput` to strip commas before `parseInt`.
- Korean copy for all user-facing strings; comments and identifiers in English.
- `randomUUID()` is generated server-side (see `app/dashboard/actions.ts`) — `transactions.id` is required, not defaulted by the DB.
