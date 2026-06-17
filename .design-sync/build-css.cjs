// Compiles app/globals.css into a static stylesheet for design-sync's cssEntry.
//
// Why this exists: the app uses Tailwind v4 (JIT) with CSS-first config. There
// is no compiled component CSS artifact in the repo — utility rules
// (bg-primary, h-8, rounded-lg, …) only materialize when Tailwind scans source
// at build time. The design-sync converter ships whatever cssEntry points at
// verbatim, so without this step the bundle would carry tokens but no utility
// rules and every component would render as an unstyled box.
//
// What it does: reads app/globals.css, scopes Tailwind's source scan to
// components/ui + .design-sync/previews (NOT the whole app — the app has
// Supabase-bound feature dirs we never sync), drops the Pretendard @import
// (the font ships separately via cfg.extraFonts so we don't bake broken
// node_modules subset URLs into the shipped CSS), and compiles via
// @tailwindcss/postcss. Output is gitignored and regenerated each build.
//
// Run before the converter (wired as cfg.buildCmd so re-sync re-runs it).

const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

const REPO = path.resolve(__dirname, "..");
const SRC = path.join(REPO, "app", "globals.css");
const OUT_DIR = path.join(REPO, ".design-sync", ".cache");
const OUT = path.join(OUT_DIR, "tailwind-compiled.css");

// Resolve tailwind's postcss plugin + a matching postcss from the repo's tree.
const repoRequire = createRequire(path.join(REPO, "package.json"));
const twPath = repoRequire.resolve("@tailwindcss/postcss");
const twRequire = createRequire(twPath);
const postcss = twRequire("postcss");
const tailwind = require(twPath);

let css = fs.readFileSync(SRC, "utf8");

// 1. Scope the source scan. `@import "tailwindcss"` auto-detects sources from
//    cwd — replace it with source(none) + explicit @source globs.
//    We scan the WHOLE app (components/ + app/), not just the synced ui/
//    primitives: claude.ai/design renders designs against this static
//    stylesheet only (no live Tailwind), so the compiled CSS must carry the
//    full utility vocabulary the design agent will reach for — text-3xl,
//    font-bold, tracking-tight, layout/spacing utilities — which only exist
//    here if some source used them. The JS bundle stays scoped to
//    components/ui via cfg.srcDir; this CSS scan is class-extraction only and
//    pulls in no component code.
css = css.replace(
  /@import\s+["']tailwindcss["']\s*;/,
  [
    '@import "tailwindcss" source(none);',
    `@source "${path.join(REPO, "components")}";`,
    `@source "${path.join(REPO, "app")}";`,
    `@source "${path.join(REPO, ".design-sync", "previews")}";`,
  ].join("\n"),
);

// 2. Drop the Pretendard @import — the font is shipped via cfg.extraFonts.
//    Keeping it would inline node_modules-relative subset URLs that break in
//    the uploaded stylesheet.
css = css.replace(/@import\s+["']pretendard\/[^"']*["']\s*;\s*/g, "");

fs.mkdirSync(OUT_DIR, { recursive: true });

postcss([tailwind()])
  .process(css, { from: SRC, to: OUT })
  .then((res) => {
    fs.writeFileSync(OUT, res.css);
    console.error(
      `[build-css] wrote ${path.relative(REPO, OUT)} (${(res.css.length / 1024).toFixed(0)} KB)`,
    );
  })
  .catch((e) => {
    console.error("[build-css] FAILED:", e.message);
    process.exit(1);
  });
