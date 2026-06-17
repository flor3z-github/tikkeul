# design-sync notes — 티끌 (Tikkeul)

Repo-specific gotchas for `/design-sync`. This is an **app**, not a DS library —
the sync is scoped to the 15 shadcn `base-nova` primitives under
`components/ui/` only. Feature dirs (dashboard, transactions, dm, friends, …)
are RSC + Supabase-bound and are intentionally NOT synced.

## Off-script bits (this repo is outside the converter's standard envelope)

- **No `dist/`, no library build.** synth-entry mode is triggered by passing a
  **non-existent `--entry`** path (e.g. `--entry ./__nonexistent.js`). The
  converter's PKG_DIR walk-up uses the path string (no existence check) to find
  the repo's `package.json` (name `tikkeul`) → PKG_DIR = repo root; meanwhile
  `resolveDistEntry(soft)` returns null on the missing path → src synthesis.
  `[NO_DIST]` lines on stderr are EXPECTED, not errors.
- **`cfg.srcDir` MUST stay `components/ui`.** Without it the source-root default
  walks the entire `components/` tree and the synth entry pulls Supabase-bound
  feature components into the bundle → build blows up.
- **Tailwind v4 JIT → no compiled component CSS exists.** `.design-sync/build-css.cjs`
  compiles `app/globals.css` (scoped to `components/ui` + `.design-sync/previews`,
  Pretendard `@import` stripped) into `.design-sync/.cache/tailwind-compiled.css`,
  which `cfg.cssEntry` points at. **Run it before every converter build** — it's
  wired as `cfg.buildCmd`, so re-sync re-runs it. Output is gitignored and
  regenerated deterministically. If you author preview `.tsx` that use new
  utility classes for layout, re-run build-css so those classes get generated.
- **Pretendard font** ships via `cfg.extraFonts` →
  `node_modules/pretendard/dist/web/variable/pretendardvariable.css` (family
  `Pretendard Variable`, single 2 MB variable woff2). Stripped from the
  compiled CSS to avoid baking node_modules subset URLs into the shipped sheet.

## Converter invocation

```
node .design-sync/build-css.cjs
node .ds-sync/package-build.mjs --config .design-sync/config.json \
  --node-modules ./node_modules --entry ./__nonexistent.js --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
```

## Build decisions worth knowing

- **CSS `@source` scans the WHOLE app** (`components/` + `app/`), not just
  `components/ui`. claude.ai/design renders designs against the static
  `styles.css` closure only (no live Tailwind), so the compiled CSS must carry
  the full utility vocabulary the design agent will write (`text-xl`, `font-bold`,
  `tracking-tight`, layout/spacing). Result ≈ 98 KB `_ds_bundle.css`. The JS
  bundle stays scoped to `components/ui` via `cfg.srcDir` — the CSS scan is
  class-extraction only, pulls in no component code.
- **`componentSrcMap` excludes 5 blank subcomponents** (CardFooter, DialogFooter,
  DrawerFooter, DrawerHeader, RadioGroupItem) from the card set — they render
  near-empty alone and only make sense inside their parent. Still bundle-exported
  (synth `export *`), just no separate card; composed inside parent previews.
- **`cfg.overrides.Popover = {cardMode:"single"}`** — its portal content escapes
  the grid cell otherwise ([GRID_OVERFLOW]).

## Known render warns (triaged, not new on re-sync)

- `tokens: N defined, M referenced (1 missing, below threshold)` — non-blocking,
  a token referenced by component CSS that no shipped sheet defines; below the
  validator's threshold. Expected.

## Conventions header — validated names

`.design-sync/conventions.md` names token utilities (bg-primary, text-muted-foreground,
border-border…), the `--radius`/status vars, and component names. Every class/token
named was grepped against the SHIPPED `ds-bundle/_ds_bundle.css` (98 KB) before
upload — re-validate on re-sync (the type scale tops at `text-xl`; the header tells
the agent to use inline style for big hero numbers).

## Preview scope

User chose scope (a): author rich previews for the cleanly-rendering primitives
(~9-10: Button/Badge/Card/Input/Label/Skeleton/Switch/RadioGroup/Calendar/Popover),
floor-card the overlay/portal-bound ones (Sonner toast, vaul Drawer/BottomSheet,
Dialog/AlertDialog) which fight static headless capture.

## Usage verification + prune (2026-06-17)

A usage audit (grep of `@/components/ui/*` imports across the real app, excluding
components/ui itself) found ~20 of the original 58 exports are **never used** by
the app. The sync was pruned to reflect real usage — final card set = **32**
(was 53). Pruned via `componentSrcMap: null` (still bundle-exported, just no card):
- **Badge** — 0 imports anywhere (the `FixedCategoryBadge` matches are a different
  `lib/utils` thing).
- **entire Dialog family** (10) — 0 imports. The app does modals with
  Drawer/BottomSheet, never Dialog. Dead code.
- **Card subcomponents** (CardHeader/Title/Description/Action/Footer) — the app
  only ever imports `{ Card, CardContent }` and styles a `rounded-3xl` list.
- CalendarDayButton, Drawer{Trigger,Portal,Overlay,Footer}, Popover{Title,Header,Description}.

DrawerHeader and RadioGroupItem ARE used by the app but render blank standalone,
so they stay pruned-from-cards (composed inside parent previews) yet
bundle-exported.

Authored previews were re-fitted to real usage: **Card** → Card+CardContent list
(matches calendar-day-panel.tsx), **Button** → real-used variants
(outline/ghost/destructive dominant) + icon buttons (icon-sm/icon). Badge preview
file kept on disk (`.design-sync/previews/Badge.tsx`) for if Badge is ever adopted.

If the app later starts using a pruned primitive, drop its `null` from
componentSrcMap and re-sync.

## Re-sync risks

- `tailwind-compiled.css` is derived from `app/globals.css` at build time — if
  the app's tokens/utilities change, re-run build-css (cfg.buildCmd does this).
- The `--entry ./__nonexistent.js` synth-entry trick depends on converter
  internals (PKG_DIR walk-up not checking existence). If a converter upgrade
  changes that, switch to a real synth approach.
- Pretendard is pinned to the installed version's single-file variable css; a
  pretendard major that renames that file breaks `cfg.extraFonts`.
