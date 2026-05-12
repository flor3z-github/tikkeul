"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatKRW, formatNumber } from "@/lib/utils/money";
import { ActiveItemSheet } from "./active-item-sheet";
import { CatalogToggleSheet } from "./catalog-toggle-sheet";
import { ManualAddSheet } from "./manual-add-sheet";
import { type FixedExpenseRow, type SubscriptionPlan } from "./types";

type FixedExpensesViewProps = {
  items: FixedExpenseRow[];
  plans: SubscriptionPlan[];
};

const CATEGORY_ORDER = [
  "AI",
  "OTT",
  "음악",
  "멤버십",
  "배달",
  "생산성",
  "독서/교육",
  "클라우드",
] as const;

function groupPlansByCategory(plans: SubscriptionPlan[]) {
  const groups = new Map<string, SubscriptionPlan[]>();
  for (const plan of plans) {
    const key = plan.category ?? "기타";
    const list = groups.get(key) ?? [];
    list.push(plan);
    groups.set(key, list);
  }
  const ordered: { category: string; plans: SubscriptionPlan[] }[] = [];
  for (const cat of CATEGORY_ORDER) {
    const list = groups.get(cat);
    if (list && list.length > 0) {
      ordered.push({ category: cat, plans: list });
      groups.delete(cat);
    }
  }
  // Append any remaining categories that weren't in the explicit order.
  for (const [category, list] of groups) {
    ordered.push({ category, plans: list });
  }
  return ordered;
}

/**
 * Group plans within a category by service_name, preserving first-seen order
 * (which already reflects sort_order from the server query).
 */
function groupPlansByService(plans: SubscriptionPlan[]) {
  const groups = new Map<string, SubscriptionPlan[]>();
  for (const plan of plans) {
    const list = groups.get(plan.service_name) ?? [];
    list.push(plan);
    groups.set(plan.service_name, list);
  }
  return Array.from(groups.entries()).map(([serviceName, planList]) => ({
    serviceName,
    planList,
  }));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

export function FixedExpensesView({ items, plans }: FixedExpensesViewProps) {
  const [catalogPlan, setCatalogPlan] = useState<SubscriptionPlan | null>(null);
  const [activeItem, setActiveItem] = useState<FixedExpenseRow | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const filterApplied = query.trim().length > 0 || categoryFilter !== null;
  const normalizedQuery = useMemo(() => normalize(query), [query]);

  // Build the active-plan lookup so catalog buttons know their toggle state.
  const itemByPlanId = useMemo(() => {
    const map = new Map<string, FixedExpenseRow>();
    for (const it of items) {
      if (it.subscription_plan_id) map.set(it.subscription_plan_id, it);
    }
    return map;
  }, [items]);

  // Reverse lookup: catalog default for an active item (if it came from the
  // catalog). Used to surface a price diff hint next to the user's amount.
  const planById = useMemo(() => {
    const map = new Map<string, SubscriptionPlan>();
    for (const plan of plans) map.set(plan.id, plan);
    return map;
  }, [plans]);

  // "사용 중" stays pinned above the search bar and is NOT affected by the
  // search/filter — those controls only narrow the catalog grid below.
  const activeItems = useMemo(
    () => items.filter((it) => it.is_active),
    [items],
  );
  const total = activeItems.reduce((sum, it) => sum + it.amount, 0);

  // Catalog filtering: search box + category chip.
  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      if (categoryFilter && plan.category !== categoryFilter) return false;
      if (normalizedQuery) {
        const hay = normalize(
          `${plan.service_name}${plan.plan_name ?? ""}${plan.category ?? ""}`,
        );
        if (!hay.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [plans, normalizedQuery, categoryFilter]);

  const grouped = useMemo(
    () => groupPlansByCategory(filteredPlans),
    [filteredPlans],
  );

  const catalogEmptyAfterFilter = filterApplied && grouped.length === 0;

  function handleCatalogClick(plan: SubscriptionPlan) {
    const existing = itemByPlanId.get(plan.id);
    if (existing && existing.is_active) {
      // Active → open the item sheet (edit / deactivate / delete).
      setActiveItem(existing);
    } else {
      // Inactive (never added, or deactivated) → open catalog toggle sheet.
      setCatalogPlan(plan);
    }
  }

  function handleClearFilters() {
    setQuery("");
    setCategoryFilter(null);
  }

  // Dynamic edge fades on the horizontal category chip row.
  // - left fade appears once the user has scrolled away from the start
  // - right fade appears as long as there's overflow ahead
  // Tracked via scroll + ResizeObserver so font load / viewport changes
  // re-measure correctly.
  const chipsScrollRef = useRef<HTMLDivElement | null>(null);
  const [chipsFadeLeft, setChipsFadeLeft] = useState(false);
  const [chipsFadeRight, setChipsFadeRight] = useState(false);

  useEffect(() => {
    const el = chipsScrollRef.current;
    if (!el) return;

    function update() {
      const node = chipsScrollRef.current;
      if (!node) return;
      const overflow = node.scrollWidth - node.clientWidth;
      const threshold = 4; // ignore sub-pixel jitter
      setChipsFadeLeft(node.scrollLeft > threshold);
      setChipsFadeRight(
        overflow > threshold && node.scrollLeft < overflow - threshold,
      );
    }

    update();
    // re-measure on the next frame in case fonts/layout settle late
    const rafId = requestAnimationFrame(update);

    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const chipsFadeMask =
    chipsFadeLeft || chipsFadeRight
      ? `linear-gradient(to right, ${
          chipsFadeLeft ? "transparent" : "black"
        } 0, black 24px, black calc(100% - 24px), ${
          chipsFadeRight ? "transparent" : "black"
        } 100%)`
      : undefined;

  return (
    <>
      <Card className="rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
        <CardContent className="space-y-2 p-6">
          <p className="text-sm font-medium text-muted-foreground">
            매달 빠지는 돈
          </p>
          <p className="text-[40px] font-bold leading-none tracking-[-0.045em] tabular-nums">
            {formatKRW(total)}
          </p>
          <p className="text-xs text-muted-foreground">
            총 {activeItems.length}개 항목 · 가용 예산 계산에 반영돼요
          </p>
        </CardContent>
      </Card>

      <section className="mt-6 space-y-3">
        <h2 className="px-1 text-[15px] font-semibold tracking-[-0.015em]">
          사용 중
        </h2>
        {activeItems.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            아래 카탈로그에서 사용 중인 구독을 눌러 추가하거나,
            <br />
            &lsquo;직접 추가&rsquo;로 월세·통신비를 등록해주세요.
          </p>
        ) : (
          <ul className="space-y-2">
            {activeItems.map((item) => {
              const plan = item.subscription_plan_id
                ? planById.get(item.subscription_plan_id)
                : null;
              const showDefault =
                plan != null && plan.default_amount !== item.amount;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setActiveItem(item)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
                  >
                    <p className="min-w-0 flex-1 truncate text-[15px] font-medium">
                      {item.name}
                    </p>
                    <div className="flex shrink-0 flex-col items-end leading-tight">
                      <span className="text-[15px] font-semibold tabular-nums">
                        {formatKRW(item.amount)}
                      </span>
                      {showDefault ? (
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          원래 가격 {formatKRW(plan.default_amount)}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Sticky catalog search + filter + manual-add. Search/filter only
          narrow the catalog grid below — "사용 중" above is unaffected. */}
      <div className="sticky top-0 z-20 -mx-5 mt-6 border-b border-border bg-background/90 px-5 pb-2 pt-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="카탈로그에서 항목 찾기"
              className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-10 text-[14px] outline-none placeholder:text-muted-foreground focus:border-ring"
              aria-label="카탈로그 검색"
            />
            {query ? (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
          >
            <Plus className="size-3.5" />
            <span>직접 추가</span>
          </button>
        </div>
        <div
          ref={chipsScrollRef}
          className="mt-2 flex gap-1.5 overflow-x-auto pb-1"
          style={{
            // hide native scrollbar visually but keep it scrollable
            scrollbarWidth: "none",
            // Edge fades signal "more chips this way". Hidden when at edge so
            // a fully-scrolled side doesn't show a misleading gradient.
            maskImage: chipsFadeMask,
            WebkitMaskImage: chipsFadeMask,
          }}
        >
          <FilterChip
            active={categoryFilter === null}
            onClick={() => setCategoryFilter(null)}
          >
            전체
          </FilterChip>
          {CATEGORY_ORDER.map((cat) => (
            <FilterChip
              key={cat}
              active={categoryFilter === cat}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </FilterChip>
          ))}
        </div>
      </div>

      {catalogEmptyAfterFilter ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            일치하는 카탈로그 항목이 없어요.
          </p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="mt-3 text-xs font-medium text-primary hover:underline"
          >
            검색·필터 초기화
          </button>
        </div>
      ) : (
        grouped.map(({ category, plans: groupPlans }) => (
          <section key={category} className="mt-6 space-y-3">
            <h2 className="px-1 text-[15px] font-semibold tracking-[-0.015em]">
              {category}
            </h2>
            <div className="space-y-3">
              {groupPlansByService(groupPlans).map(
                ({ serviceName, planList }) => (
                  <div key={serviceName} className="space-y-1.5">
                    <h3 className="px-1 text-[12px] font-medium text-muted-foreground">
                      {serviceName}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {planList.map((plan) => {
                        const existing = itemByPlanId.get(plan.id);
                        const active = existing?.is_active === true;
                        return (
                          <CatalogButton
                            key={plan.id}
                            plan={plan}
                            active={active}
                            onClick={() => handleCatalogClick(plan)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>
        ))
      )}

      <CatalogToggleSheet
        plan={catalogPlan}
        onOpenChange={(open) => {
          if (!open) setCatalogPlan(null);
        }}
      />
      <ActiveItemSheet
        item={activeItem}
        catalogDefaultAmount={
          activeItem?.subscription_plan_id
            ? (planById.get(activeItem.subscription_plan_id)?.default_amount ??
              null)
            : null
        }
        onOpenChange={(open) => {
          if (!open) setActiveItem(null);
        }}
      />
      <ManualAddSheet open={manualOpen} onOpenChange={setManualOpen} />
    </>
  );
}

type FilterChipProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
        "active:scale-[0.98]",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

type CatalogButtonProps = {
  plan: SubscriptionPlan;
  active: boolean;
  onClick: () => void;
};

function CatalogButton({ plan, active, onClick }: CatalogButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group flex max-w-full items-center gap-1.5 rounded-full border px-3.5 py-2 text-left text-[13px] font-medium transition-colors",
        "active:scale-[0.98]",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {active ? <Check className="size-3.5 shrink-0" /> : null}
      {plan.plan_name ? (
        <span className="truncate">{plan.plan_name}</span>
      ) : null}
      <span
        className={cn(
          "shrink-0 text-[11px] font-medium tabular-nums",
          active
            ? "text-primary/80"
            : plan.plan_name
              ? "text-muted-foreground"
              : "text-foreground",
        )}
      >
        {formatNumber(plan.default_amount)}원
      </span>
    </button>
  );
}
