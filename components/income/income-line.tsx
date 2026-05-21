"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import {
  IncomeFormDialog,
  type IncomeAdjustmentInitial,
} from "@/components/income/income-form-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { formatKoreanShortDate } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/money";

export type IncomeLineItem = {
  id: string;
  amount: number;
  occurredOn: string;
  memo: string | null;
};

type IncomeLineProps = {
  items: IncomeLineItem[];
  /** Aggregated amount, computed by the page so the line stays in lockstep with the budget math. */
  totalAmount: number;
  /** YYYY-MM-DD, inclusive cycle start (for the editor's calendar bounds). */
  cycleStartDate: string;
  /** YYYY-MM-DD, exclusive cycle end. */
  cycleEndDate: string;
  cycleMode?: "calendar" | "income_day";
};

// Parse YYYY-MM-DD into a local-midnight Date. Matches the editor's own
// parsing so the calendar boundary checks line up.
function parseYmd(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function IncomeLine({
  items,
  totalAmount,
  cycleStartDate,
  cycleEndDate,
  cycleMode,
}: IncomeLineProps) {
  const [listOpen, setListOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeAdjustmentInitial | null>(null);

  const cycleStart = useMemo(() => parseYmd(cycleStartDate), [cycleStartDate]);
  const cycleEnd = useMemo(() => parseYmd(cycleEndDate), [cycleEndDate]);

  const cycleNoun = cycleMode === "income_day" ? "주기" : "달";

  function handleSelect(item: IncomeLineItem) {
    setEditing(item);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setListOpen(true)}
        className="-mx-1 flex w-[calc(100%+0.5rem)] items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 active:bg-muted"
      >
        <span>
          이번 {cycleNoun} 추가 수입{" "}
          <span className="font-semibold tabular-nums text-foreground">
            +{formatNumber(totalAmount)}원
          </span>
        </span>
        <ChevronRight
          className="size-3.5 shrink-0 text-muted-foreground/60"
          aria-hidden
        />
      </button>

      <Drawer
        open={listOpen}
        onOpenChange={(open) => {
          setListOpen(open);
          // Clear nested edit target so the form doesn't auto-reopen with a
          // stale item the next time the list is opened.
          if (!open) setEditing(null);
        }}
      >
        <DrawerContent className="border-white/10 bg-background px-5 pb-8 pt-4">
          <DrawerHeader className="px-0 pb-3 pt-2 text-left">
            <DrawerTitle className="text-[20px] font-bold tracking-[-0.025em]">
              이번 {cycleNoun} 추가 수입
            </DrawerTitle>
            <DrawerDescription className="text-[13px] text-muted-foreground">
              항목을 탭하면 수정하거나 삭제할 수 있어요.
            </DrawerDescription>
          </DrawerHeader>

          {items.length === 0 ? (
            <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              이번 {cycleNoun}에 등록된 추가 수입이 없어요.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 active:bg-muted"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-[15px] font-semibold tabular-nums">
                        +{formatNumber(item.amount)}원
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        {formatKoreanShortDate(parseYmd(item.occurredOn))}
                        {item.memo ? (
                          <>
                            {" · "}
                            <span className="text-foreground/80">
                              {item.memo}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Nested form drawer — opens on top of the list sheet so the user
              returns to the list after editing/deleting. NestedRoot makes vaul
              scale the list automatically. */}
          <IncomeFormDialog
            nested
            open={editing !== null}
            onOpenChange={(open) => {
              if (!open) setEditing(null);
            }}
            cycleStart={cycleStart}
            cycleEnd={cycleEnd}
            defaultDate={editing?.occurredOn ?? cycleStartDate}
            initial={editing ?? undefined}
          />
        </DrawerContent>
      </Drawer>
    </>
  );
}
