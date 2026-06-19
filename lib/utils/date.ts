export function monthStart(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function monthEnd(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
}

export function toISODate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function todayISODate(): string {
  return toISODate(new Date());
}

/**
 * Current wall-clock time in Asia/Seoul as a host-local Date.
 *
 * Vercel functions run in UTC, but the cycle/date engine reads only `now`'s
 * local-accessor components (getFullYear/getMonth/getDate/getHours...). Calling
 * `new Date()` server-side therefore yields UTC components and mis-resolves the
 * cycle during 00:00-09:00 KST. This returns a Date whose local components equal
 * the current Asia/Seoul wall clock regardless of the host timezone.
 */
export function nowInSeoul(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0; // some engines emit "24" for midnight with hour12:false
  return new Date(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
}

const koreanShortDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
});

export function formatKoreanShortDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  return koreanShortDateFormatter.format(date);
}

const koreanFullDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function formatKoreanFullDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  return koreanFullDateFormatter.format(date);
}

/**
 * Returns "오늘" / "어제" / "5월 11일" depending on how far `input` is from
 * today (local time). Used as date-group headers so the most relevant rows
 * read naturally.
 */
export function formatRelativeKoreanDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date();
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const diffDays = Math.round(
    (todayMidnight.getTime() - target.getTime()) / 86_400_000,
  );
  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  return koreanShortDateFormatter.format(date);
}

const CHAT_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function formatChatDateSeparator(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = CHAT_WEEKDAYS[date.getDay()];
  return `${y}년 ${m}월 ${d}일 (${w})`;
}

export function formatChatTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

