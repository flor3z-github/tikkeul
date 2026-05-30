import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Public holidays drive the Model B business-day adjustment (see
 * lib/utils/payday-cycle.ts). The `holidays.d` column is a Postgres `date`,
 * which supabase-js returns as a 'YYYY-MM-DD' string — we keep those strings
 * verbatim and never round-trip through `new Date()` (a UTC parse would shift
 * the day in KST). The engine keys its lookups on `toISODate(date)`, which
 * produces the same local-tz 'YYYY-MM-DD' string, so the Set comparison stays
 * tz-consistent.
 *
 * On any query error we return an empty Set: with no holidays loaded the
 * engine treats every weekday as a business day (weekends are still handled in
 * code). This is documented graceful degradation, not silent data loss.
 */

async function fetchHolidays(
  yearStart: number,
  yearEnd: number,
  client: ServerClient,
): Promise<Set<string>> {
  const { data, error } = await client
    .from("holidays")
    .select("d")
    .gte("d", `${yearStart}-01-01`)
    .lte("d", `${yearEnd}-12-31`);

  if (error || !data) return new Set<string>();
  return new Set(data.map((row) => row.d));
}

// Cache by (yearStart, yearEnd) for the duration of a single server render so
// the dashboard and any sibling consumers in the same request share one
// round-trip. `cache` keys on the primitive args; the optional client param is
// intentionally excluded from the cache key (it's the same request-scoped
// client either way).
const cachedFetchHolidays = cache(
  async (yearStart: number, yearEnd: number): Promise<Set<string>> => {
    const client = await createClient();
    return fetchHolidays(yearStart, yearEnd, client);
  },
);

/**
 * Loads public holidays for [yearStart-01-01, yearEnd-12-31] as a Set of
 * 'YYYY-MM-DD' strings. Pass an existing server `client` (from an RSC that
 * already created one) to reuse its cookie context and avoid a second client
 * construction; omit it to let the per-request cache build and share one.
 */
export async function getHolidays(
  yearStart: number,
  yearEnd: number,
  client?: ServerClient,
): Promise<Set<string>> {
  if (client) return fetchHolidays(yearStart, yearEnd, client);
  return cachedFetchHolidays(yearStart, yearEnd);
}

/**
 * Cycles cross year boundaries — a January cycle can start in the prior-year
 * December (e.g. 1/1 신정 → prev → 12/31), and a December 말일 cycle can end in
 * the next-year January. So any cycle computed for `anchorYear` needs holidays
 * loaded for the surrounding ±1 year.
 */
export function holidayRangeForAnchor(anchorYear: number): {
  yearStart: number;
  yearEnd: number;
} {
  return { yearStart: anchorYear - 1, yearEnd: anchorYear + 1 };
}
