"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import {
  searchTransactionsByMemoAction,
  type SearchMemoResultItem,
} from "@/app/dashboard/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CategoryIcon } from "@/lib/utils/category-icon";
import { formatKRW } from "@/lib/utils/money";
import {
  formatKoreanFullDate,
  formatRelativeKoreanDate,
  toISODate,
} from "@/lib/utils/date";
import { getCycleRange, type CycleMode } from "@/lib/utils/calendar";
import { cn } from "@/lib/utils";

type SearchSheetProps = {
  cycleMode: CycleMode;
  cycleStartDay: number;
};

const DEBOUNCE_MS = 300;

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ok";
      query: string;
      items: SearchMemoResultItem[];
      truncated: boolean;
    }
  | { status: "error"; error: string };

export function SearchSheet({ cycleMode, cycleStartDay }: SearchSheetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const router = useRouter();
  const inputId = useId();

  // Reset on open. The empty-query render path also covers "idle" so we don't
  // strictly need to clear `state`, but doing it here keeps the next open from
  // flashing a stale "검색 중…" if the previous session ended mid-flight.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      setState({ status: "idle" });
      requestIdRef.current += 1;
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length > 0) {
      // Surface "검색 중…" immediately on input rather than waiting for the
      // 300 ms debounce to fire. Without this the previous result lingers
      // looking stale.
      setState({ status: "loading" });
    }
  }

  // Debounced server search. setState inside the timeout callback (not the
  // effect body) — lint forbids synchronous setState in an effect body, and
  // there's no cascade risk because the callback runs after the debounce.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      requestIdRef.current += 1;
      return;
    }
    const ticket = ++requestIdRef.current;
    const handle = window.setTimeout(async () => {
      const result = await searchTransactionsByMemoAction(trimmed);
      if (ticket !== requestIdRef.current) return;
      if (!result.ok) {
        setState({ status: "error", error: result.error });
        return;
      }
      setState({
        status: "ok",
        query: trimmed,
        items: result.items,
        truncated: result.truncated,
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  function handleResultTap(item: SearchMemoResultItem) {
    const txDate = new Date(item.spent_at);
    const range = getCycleRange(cycleMode, cycleStartDay, txDate);
    const params = new URLSearchParams();
    params.set("ym", range.anchorYm);
    params.set("day", toISODate(txDate));
    params.set("focus", item.id);
    setOpen(false);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <>
      <button
        type="button"
        aria-label="검색"
        onClick={() => setOpen(true)}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "rounded-full text-muted-foreground",
        )}
      >
        <Search className="size-5" />
      </button>

      <BottomSheet
        open={open}
        onOpenChange={handleOpenChange}
        title="검색"
        description="메모를 기준으로 소비를 검색합니다."
      >
        <div className="flex min-h-0 flex-1 flex-col px-1">
          <label htmlFor={inputId} className="sr-only">
            메모 검색어
          </label>
          {/* Input's focus-visible ring extends 3px outside the box. The
              parent BottomSheet's inner scroller uses overflow-y-auto, which
              per CSS spec forces overflow-x to auto too, clipping the ring
              on the left/right edges. The px-1 wrapper above leaves enough
              gutter for the ring to render without being clipped. */}
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={inputId}
              ref={inputRef}
              autoFocus
              // type="text" not "search" — WebKit renders a native clear
              // button for type="search" inputs which would duplicate the
              // custom X button below. inputMode/enterKeyHint already drive
              // the mobile keyboard's search affordance.
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={query}
              placeholder="메모로 검색"
              onChange={(event) => handleQueryChange(event.target.value)}
              className="h-11 rounded-2xl border border-border bg-card pl-9 pr-10 text-[15px]"
            />
            {query.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="검색어 지우기"
                className="absolute right-1.5 top-1/2 size-7 -translate-y-1/2 rounded-full text-muted-foreground"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>

          <SearchResults
            state={state}
            query={query.trim()}
            onTap={handleResultTap}
          />
        </div>
      </BottomSheet>
    </>
  );
}

type SearchResultsProps = {
  state: FetchState;
  query: string;
  onTap: (item: SearchMemoResultItem) => void;
};

function SearchResults({ state, query, onTap }: SearchResultsProps) {
  if (state.status === "loading") {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-6 px-1 text-center text-[14px] text-muted-foreground"
      >
        검색 중…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <p
        role="alert"
        className="mt-6 rounded-2xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive"
      >
        {state.error}
      </p>
    );
  }

  // Both the empty-query state and a zero-result state collapse to the same
  // "no matches" line. They're indistinguishable from the user's POV — both
  // mean "nothing to show here yet" — and a single shared line keeps the
  // sheet feeling quiet until results land.
  const showEmpty =
    query.length === 0 ||
    (state.status === "ok" && state.items.length === 0);
  if (showEmpty) {
    return (
      <p className="mt-6 px-1 text-center text-[14px] text-muted-foreground">
        일치하는 소비가 없어요
      </p>
    );
  }

  if (state.status !== "ok") return null;

  return (
    <>
      <ul className="mt-3 space-y-1">
        {state.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onTap(item)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-muted/60 active:bg-muted"
            >
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/80"
                style={
                  item.category_color
                    ? { backgroundColor: `${item.category_color}1A` }
                    : undefined
                }
              >
                <CategoryIcon
                  slug={item.category_icon}
                  className="size-[18px]"
                  style={
                    item.category_color
                      ? { color: item.category_color }
                      : undefined
                  }
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-medium leading-tight">
                    {item.category_name ?? "기타"}
                  </span>
                  <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                    {formatSearchResultDate(item.spent_at)}
                  </span>
                </span>
                <span className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] text-muted-foreground">
                    <HighlightedMemo memo={item.memo} query={state.query} />
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums">
                    {formatKRW(item.amount)}
                  </span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {state.truncated ? (
        <p className="mt-3 px-1 pb-1 text-center text-[12px] text-muted-foreground">
          결과가 100건을 초과해요. 검색어를 더 구체적으로 입력해주세요.
        </p>
      ) : null}
    </>
  );
}

// Search spans the full transaction history, so results from past years would
// be ambiguous if rendered as "5월 15일". Fall back to the full Korean date
// for any item whose year differs from today.
function formatSearchResultDate(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  if (date.getFullYear() === new Date().getFullYear()) {
    return formatRelativeKoreanDate(input);
  }
  return formatKoreanFullDate(input);
}

function HighlightedMemo({ memo, query }: { memo: string; query: string }) {
  if (query.length === 0) return <>{memo}</>;
  const lowerMemo = memo.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const segments: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  while (cursor < memo.length) {
    const idx = lowerMemo.indexOf(lowerQuery, cursor);
    if (idx === -1) {
      segments.push({ text: memo.slice(cursor), match: false });
      break;
    }
    if (idx > cursor) {
      segments.push({ text: memo.slice(cursor, idx), match: false });
    }
    segments.push({
      text: memo.slice(idx, idx + lowerQuery.length),
      match: true,
    });
    cursor = idx + lowerQuery.length;
  }
  return (
    <>
      {segments.map((seg, i) =>
        seg.match ? (
          <mark
            key={i}
            className="rounded bg-primary/20 px-0.5 text-foreground"
          >
            {seg.text}
          </mark>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}
