"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { CalendarIcon, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import { submitTransactionAction } from "@/app/dashboard/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatKoreanShortDate, toISODate } from "@/lib/utils/date";
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
};

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[28px] border-white/10 bg-background px-5 pb-8 pt-4"
      >
        <SheetHeader className="px-0 pb-3 text-left">
          <SheetTitle className="text-[22px] font-bold tracking-[-0.025em]">
            {initial ? "소비 수정" : "소비 추가"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            카테고리, 금액, 날짜를 입력해 소비를 기록합니다.
          </SheetDescription>
        </SheetHeader>

        {open ? (
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
        ) : null}
      </SheetContent>
    </Sheet>
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
    return parseDefaultDate(defaultDate) ?? new Date();
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Stack of quick-amount additions for the undo (←) button. Cleared whenever
  // the amount is reset or edited manually so the history can't lie.
  const [quickHistory, setQuickHistory] = useState<number[]>([]);

  const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
  const canSubmit = amountValue > 0 && categoryId !== null && !pending;
  const amountInputRef = useRef<HTMLInputElement>(null);

  function focusAmountInput() {
    const el = amountInputRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
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

    startTransition(async () => {
      const result = await submitTransactionAction({
        id: initial?.id,
        amount: amountValue,
        categoryId,
        spentAt: toISODate(spentDate),
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
                  className="flex size-7 items-center justify-center rounded-full bg-card text-muted-foreground transition-colors hover:bg-background active:scale-[0.96]"
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
                  className="flex size-7 items-center justify-center rounded-full bg-card text-muted-foreground transition-colors hover:bg-background active:scale-[0.96]"
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
              autoFocus
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
              className="h-9 rounded-full border border-border bg-card text-xs font-medium tabular-nums transition-colors hover:bg-muted active:scale-[0.98]"
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
        <div className="-mx-1 flex flex-wrap gap-2">
          {categories.map((category) => {
            const selected = category.id === categoryId;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-[13px] font-medium transition-all",
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
        <label className="block text-sm font-medium text-muted-foreground">
          날짜
        </label>
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger
            type="button"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-12 w-full justify-start gap-2 rounded-2xl px-4 text-[15px] font-medium",
            )}
          >
            <CalendarIcon className="size-4" />
            {formatKoreanShortDate(spentDate)}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={spentDate}
              onSelect={(date) => {
                if (date) {
                  setSpentDate(date);
                  setDatePickerOpen(false);
                }
              }}
              disabled={(date) => date > new Date()}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button
        type="submit"
        disabled={!canSubmit}
        className="h-12 w-full rounded-full text-[15px] font-semibold"
      >
        {pending
          ? mode === "edit"
            ? "수정 중…"
            : "추가 중…"
          : mode === "edit"
            ? "수정하기"
            : "추가하기"}
      </Button>
    </form>
  );
}
