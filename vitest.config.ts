import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Path alias: the official Vitest guide resolves tsconfig `paths` (here
// `@/* -> ./*`) via the vite-tsconfig-paths plugin — Vite does not read
// tsconfig.json for module resolution on its own.
// https://vitest.dev/guide/common-errors
//
// Timezone: the date utils (`lib/utils/{date,calendar,payment-day}.ts`) build
// and read dates with LOCAL components (getFullYear/getMonth/getDate,
// new Date(y, m, d)). The same helpers run server-side on Vercel (UTC) and
// client-side in the browser (KST), so results are TZ-dependent. Tests pin TZ
// via the npm scripts (`TZ=Asia/Seoul` default, `TZ=UTC` for the server
// surface): TZ must be set in the process environment before V8 initializes,
// so a config/setup-file assignment would be unreliable. Time-of-day is mocked
// per-test with vi.useFakeTimers()/vi.setSystemTime() per the Vitest dates
// guide (https://vitest.dev/guide/mocking#dates).
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
