"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CalendarIcon, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTransactionAction,
  submitTransactionAction,
} from "@/app/dashboard/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import {
  formatKoreanFullDate,
  hasExplicitTime,
  toISODate,
} from "@/lib/utils/date";
import { formatNumber, parseAmountInput } from "@/lib/utils/money";

const QUICK_AMOUNTS: { value: number; label: string }[] = [
  { value: 1_000, label: "1천" },
  { value: 5_000, label: "5천" },
  { value: 10_000, label: "1만" },
  { value: 50_000, label: "5만" },
  { value: 100_000, label: "10만" },
];

export type TransactionFormCategory = {
  id: string;
  name: string;
  icon: string | null;
};

export type TransactionFormInitial = {
  id: string;
  amount: number;
  category_id: string | null;
  spent_at: string;
  memo: string | null;
};

const MEMO_MAX_LENGTH = 100;

type TransactionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: TransactionFormCategory[];
  initial?: TransactionFormInitial | null;
  /** YYYY-MM-DD. Initial date for create mode; ignored in edit mode. */
  defaultDate?: string;
  onSaved?: () => void;
};

export function TransactionFormDialog({
  open,
  onOpenChange,
  categories,
  initial,
  defaultDate,
  onSaved,
}: TransactionFormDialogProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-white/10 bg-background px-5 pb-8 pt-2">
        <DrawerHeader className="px-0 pb-3 pt-2 text-left">
          <DrawerTitle className="text-[22px] font-bold tracking-[-0.025em]">
            {initial ? "소비 수정" : "소비 추가"}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            카테고리, 금액, 날짜를 입력해 소비를 기록합니다.
          </DrawerDescription>
        </DrawerHeader>

        {/* Body renders unconditionally so the drawer keeps its full height
            during vaul's close animation. Radix Presence unmounts the whole
            DrawerContent (and this body with it) after the animation ends,
            so each reopen gets a freshly mounted body with reset state. */}
        <TransactionFormBody
          key={initial?.id ?? `create-${defaultDate ?? "today"}`}
          initial={initial ?? null}
          categories={categories}
          defaultDate={defaultDate}
          onSaved={() => {
            onOpenChange(false);
            onSaved?.();
          }}
        />
      </DrawerContent>
    </Drawer>
  );
}

type FormBodyProps = {
  initial: TransactionFormInitial | null;
  categories: TransactionFormCategory[];
  defaultDate?: string;
  onSaved: () => void;
};

function parseDefaultDate(value: string | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null;
  }
  if (dt.getTime() > Date.now()) return null;
  return dt;
}

function pickCreateDefaultDate(defaultDate: string | undefined): Date {
  const fromDefault = parseDefaultDate(defaultDate);
  const now = new Date();
  if (!fromDefault) return now;
  // If the picked day is today, default to current time so today's entries
  // feel live. For past days, default to noon (12:00) — a neutral midday
  // placeholder rather than midnight, which would group oddly near edges.
  if (toISODate(fromDefault) === toISODate(now)) return now;
  fromDefault.setHours(12, 0, 0, 0);
  return fromDefault;
}

function formatTimeInputValue(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function TransactionFormBody({
  initial,
  categories,
  defaultDate,
  onSaved,
}: FormBodyProps) {
  const mode = initial ? "edit" : "create";

  const [amountText, setAmountText] = useState(() =>
    initial ? formatNumber(Number(initial.amount)) : "",
  );
  const [categoryId, setCategoryId] = useState<string | null>(() =>
    initial ? initial.category_id : (categories[0]?.id ?? null),
  );
  const [spentDate, setSpentDate] = useState<Date>(() => {
    if (initial) return new Date(initial.spent_at);
    return pickCreateDefaultDate(defaultDate);
  });
  const [hasTime, setHasTime] = useState<boolean>(() => {
    if (initial) return hasExplicitTime(initial.spent_at);
    return true;
  });
  const [memoText, setMemoText] = useState(() => initial?.memo ?? "");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  // Stack of quick-amount additions for the undo (←) button. Cleared whenever
  // the amount is reset or edited manually so the history can't lie.
  const [quickHistory, setQuickHistory] = useState<number[]>([]);

  const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
  const busy = pending || deletePending;
  const canSubmit = amountValue > 0 && categoryId !== null && !busy;
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Mirror the fixed-expenses catalog filter UX: single-row horizontal scroll
  // for category chips, with edge fades that only appear when there's more to
  // scroll on that side.
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);
  const [categoryFadeLeft, setCategoryFadeLeft] = useState(false);
  const [categoryFadeRight, setCategoryFadeRight] = useState(false);

  useEffect(() => {
    const el = categoryScrollRef.current;
    if (!el) return;

    function update() {
      const node = categoryScrollRef.current;
      if (!node) return;
      const overflow = node.scrollWidth - node.clientWidth;
      const threshold = 4;
      setCategoryFadeLeft(node.scrollLeft > threshold);
      setCategoryFadeRight(
        overflow > threshold && node.scrollLeft < overflow - threshold,
      );
    }

    update();
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

  const categoryFadeMask =
    categoryFadeLeft || categoryFadeRight
      ? `linear-gradient(to right, ${
          categoryFadeLeft ? "transparent" : "black"
        } 0, black 24px, black calc(100% - 24px), ${
          categoryFadeRight ? "transparent" : "black"
        } 100%)`
      : undefined;

  function focusAmountInput() {
    const el = amountInputRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }

  function handleDelete() {
    if (!initial) return;
    startDeleteTransition(async () => {
      const result = await deleteTransactionAction(initial.id);
      if (result.ok) {
        toast.success("삭제됐어요.");
        setConfirmDeleteOpen(false);
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleQuickAdd(value: number) {
    setAmountText((prev) => formatNumber(parseAmountInput(prev) + value));
    setQuickHistory((prev) => [...prev, value]);
  }

  function handleUndoQuickAdd() {
    // Read history from closure rather than inside the setQuickHistory
    // updater — StrictMode invokes updater functions twice in dev, which
    // would subtract the same value twice if we nested setAmountText.
    if (quickHistory.length === 0) return;
    const last = quickHistory[quickHistory.length - 1];
    setAmountText((current) =>
      formatNumber(Math.max(0, parseAmountInput(current) - last)),
    );
    setQuickHistory((prev) => prev.slice(0, -1));
  }

  function handleClearAmount() {
    setAmountText("");
    setQuickHistory([]);
  }

  function handleAmountChange(event: React.ChangeEvent<HTMLInputElement>) {
    setAmountText(formatNumber(parseAmountInput(event.target.value)));
    // Manual edits make the quick-add history unreliable — drop it.
    setQuickHistory([]);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    if (hasTime && spentDate.getTime() > Date.now()) {
      toast.error("미래 시간은 기록할 수 없어요.");
      return;
    }

    startTransition(async () => {
      const result = await submitTransactionAction({
        id: initial?.id,
        amount: amountValue,
        categoryId,
        spentAt: hasTime ? spentDate.toISOString() : toISODate(spentDate),
        memo: memoText,
      });
      if (result.ok) {
        toast.success(mode === "edit" ? "수정됐어요." : "추가됐어요.");
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted-foreground">
          금액
        </label>
        <div
          role="presentation"
          onClick={focusAmountInput}
          className="relative cursor-text rounded-2xl bg-muted px-4 py-6"
        >
          {amountValue > 0 || quickHistory.length > 0 ? (
            <div className="absolute right-3 top-3 flex gap-1.5">
              {quickHistory.length > 0 ? (
                <button
                  type="button"
                  aria-label="빠른 금액 되돌리기"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleUndoQuickAdd();
                    focusAmountInput();
                  }}
                  className="flex size-7 items-center justify-center rounded-full bg-card text-muted-foreground transition-all duration-150 ease-out hover:bg-background active:scale-[0.96]"
                >
                  <Undo2 className="size-3.5" />
                </button>
              ) : null}
              {amountValue > 0 ? (
                <button
                  type="button"
                  aria-label="금액 지우기"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleClearAmount();
                    focusAmountInput();
                  }}
                  className="flex size-7 items-center justify-center rounded-full bg-card text-muted-foreground transition-all duration-150 ease-out hover:bg-background active:scale-[0.96]"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-baseline justify-center gap-2">
            <input
              ref={amountInputRef}
              inputMode="numeric"
              value={amountText}
              onChange={handleAmountChange}
              placeholder="0"
              className="min-w-[1ch] bg-transparent text-right text-[40px] font-bold tracking-[-0.045em] tabular-nums outline-none [field-sizing:content]"
            />
            <span className="text-[22px] font-semibold text-muted-foreground">
              원
            </span>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {QUICK_AMOUNTS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleQuickAdd(value)}
              className="h-9 rounded-full border border-border bg-card text-xs font-medium tabular-nums transition-all duration-150 ease-out hover:bg-muted active:scale-[0.98]"
            >
              +{label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted-foreground">
          카테고리
        </label>
        <div
          ref={categoryScrollRef}
          className="flex gap-2 overflow-x-auto pb-1"
          style={{
            scrollbarWidth: "none",
            maskImage: categoryFadeMask,
            WebkitMaskImage: categoryFadeMask,
          }}
        >
          {categories.map((category) => {
            const selected = category.id === categoryId;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={cn(
                  "h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition-all duration-150 ease-out",
                  "active:scale-[0.98]",
                  selected
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="transaction-memo"
          className="flex items-center justify-between text-sm font-medium text-muted-foreground"
        >
          <span>메모 (선택)</span>
          <span className="text-xs tabular-nums">
            {memoText.length}/{MEMO_MAX_LENGTH}
          </span>
        </label>
        <input
          id="transaction-memo"
          type="text"
          value={memoText}
          onChange={(event) =>
            setMemoText(event.target.value.slice(0, MEMO_MAX_LENGTH))
          }
          maxLength={MEMO_MAX_LENGTH}
          placeholder="무엇에 썼나요?"
          className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40 focus:bg-background"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted-foreground">
          날짜
        </label>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger
              type="button"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-12 w-full justify-start gap-2 rounded-2xl px-4 text-[15px] font-medium",
              )}
            >
              <CalendarIcon className="size-4" />
              <span>{formatKoreanFullDate(spentDate)}</span>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 [&_button]:pointer-events-auto [&_input]:pointer-events-auto"
              align="start"
            >
              <Calendar
                mode="single"
                selected={spentDate}
                onSelect={(date) => {
                  if (date) {
                    setSpentDate((prev) => {
                      const next = new Date(date);
                      next.setHours(
                        prev.getHours(),
                        prev.getMinutes(),
                        0,
                        0,
                      );
                      return next;
                    });
                    setDatePickerOpen(false);
                  }
                }}
                disabled={(date) => {
                  const today = new Date();
                  const dayEnd = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate(),
                    23,
                    59,
                    59,
                    999,
                  );
                  return date > dayEnd;
                }}
                autoFocus
              />
            </PopoverContent>
          </Popover>
          <input
            id="transaction-time"
            type="time"
            aria-label="시간"
            value={hasTime ? formatTimeInputValue(spentDate) : ""}
            onChange={(event) => {
              const value = event.target.value;
              const m = /^(\d{2}):(\d{2})$/.exec(value);
              if (!m) {
                if (value === "") setHasTime(false);
                return;
              }
              const hh = Number(m[1]);
              const mm = Number(m[2]);
              if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return;
              const next = new Date(spentDate);
              next.setHours(hh, mm, 0, 0);
              const now = new Date();
              if (next.getTime() > now.getTime()) {
                toast.warning("미래 시간은 입력할 수 없어요.");
                const clamped = new Date(now);
                clamped.setSeconds(0, 0);
                setSpentDate(clamped);
              } else {
                setSpentDate(next);
              }
              setHasTime(true);
            }}
            className="h-12 min-w-[7.5rem] rounded-2xl border border-border bg-card px-4 text-center text-[15px] font-medium tabular-nums outline-none transition-colors focus:border-primary/40 focus:bg-background"
          />
        </div>
      </div>

      {mode === "edit" && initial ? (
        <>
          <div className="grid grid-cols-4 gap-2">
            <Button
              type="submit"
              disabled={!canSubmit}
              className="col-span-3 h-12 rounded-full text-[15px] font-semibold"
            >
              {pending ? "수정 중…" : "수정하기"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={busy}
              aria-label="삭제하기"
              className="col-span-1 h-12 rounded-full px-0 text-[15px] font-semibold"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </>
      ) : (
        <Button
          type="submit"
          disabled={!canSubmit}
          className="h-12 w-full rounded-full text-[15px] font-semibold"
        >
          {pending ? "추가 중…" : "추가하기"}
        </Button>
      )}

      {mode === "edit" && initial ? (
        <>
          <AlertDialog
            open={confirmDeleteOpen}
            onOpenChange={(open) => {
              if (!deletePending) setConfirmDeleteOpen(open);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>이 소비를 삭제할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  삭제한 소비는 목록과 합계에서 즉시 사라져요.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deletePending}>
                  취소
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    handleDelete();
                  }}
                  disabled={deletePending}
                  className={cn(
                    buttonVariants({ variant: "destructive" }),
                    "h-12 w-full rounded-full text-[15px] font-semibold",
                  )}
                >
                  {deletePending ? "삭제 중…" : "삭제"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </form>
  );
}
