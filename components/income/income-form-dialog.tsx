"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { CalendarIcon, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  addIncomeAdjustmentAction,
  deleteIncomeAdjustmentAction,
  updateIncomeAdjustmentAction,
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
  DrawerNestedRoot,
  DrawerTitle,
} from "@/components/ui/drawer";
import { formatKoreanFullDate, toISODate } from "@/lib/utils/date";
import {
  formatAmountInput,
  formatNumber,
  parseAmountInput,
} from "@/lib/utils/money";
import { cn } from "@/lib/utils";

const QUICK_AMOUNTS: { value: number; label: string }[] = [
  { value: 10_000, label: "1만" },
  { value: 50_000, label: "5만" },
  { value: 100_000, label: "10만" },
  { value: 500_000, label: "50만" },
  { value: 1_000_000, label: "100만" },
];

const MEMO_MAX_LENGTH = 100;

export type IncomeAdjustmentInitial = {
  id: string;
  amount: number;
  occurredOn: string;
  memo: string | null;
};

type IncomeFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Inclusive cycle start. Calendar disallows dates before this. */
  cycleStart: Date;
  /** Exclusive cycle end (one past the last day). */
  cycleEnd: Date;
  /** YYYY-MM-DD. Pre-fills the date field; clamped to today if future. */
  defaultDate: string;
  /** When present, the dialog enters edit mode (update + delete). */
  initial?: IncomeAdjustmentInitial;
  /**
   * Render via `DrawerNestedRoot` so the sheet can open from inside an
   * already-open drawer (e.g. the income list sheet). vaul scales the parent
   * automatically when this is true; the keyboard inset handling in
   * `DrawerContent` still applies at the nested level.
   */
  nested?: boolean;
};

export function IncomeFormDialog({
  open,
  onOpenChange,
  cycleStart,
  cycleEnd,
  defaultDate,
  initial,
  nested = false,
}: IncomeFormDialogProps) {
  const isEdit = Boolean(initial);
  const Root = nested ? DrawerNestedRoot : Drawer;
  return (
    <Root open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-white/10 bg-background px-5 pb-8 pt-4">
        <DrawerHeader className="px-0 pb-3 pt-2 text-left">
          <DrawerTitle className="text-[20px] font-bold tracking-[-0.025em]">
            {isEdit ? "추가 수입 수정" : "추가 수입"}
          </DrawerTitle>
          <DrawerDescription className="text-[13px] text-muted-foreground">
            {isEdit
              ? "금액·날짜·메모를 바꾸거나 삭제할 수 있어요."
              : "이번 주기에 들어온 일회성 수입을 기록해요."}
          </DrawerDescription>
        </DrawerHeader>
        {/* Reset body state per item (or per default date in add mode). */}
        <IncomeFormBody
          key={initial?.id ?? `income-${defaultDate}`}
          cycleStart={cycleStart}
          cycleEnd={cycleEnd}
          defaultDate={defaultDate}
          initial={initial}
          onSaved={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Root>
  );
}

type FormBodyProps = {
  cycleStart: Date;
  cycleEnd: Date;
  defaultDate: string;
  initial?: IncomeAdjustmentInitial;
  onSaved: () => void;
};

// Parse YYYY-MM-DD into a local-midnight Date. Falls back to today, and
// clamps a future date down to today since the server rejects future
// `occurred_on` values anyway — better to show the user the date they can
// actually submit.
function parseDefaultDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const today = new Date();
  const todayMid = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  if (!m) return todayMid;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return todayMid;
  if (dt.getTime() > todayMid.getTime()) return todayMid;
  return dt;
}

// Parse a stored YYYY-MM-DD without the today-clamp — edit mode trusts
// whatever is on the row, even if the server's future check would block a
// brand-new entry on that date today.
function parseStoredDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return parseDefaultDate(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

function IncomeFormBody({
  cycleStart,
  cycleEnd,
  defaultDate,
  initial,
  onSaved,
}: FormBodyProps) {
  const isEdit = Boolean(initial);
  const [amountText, setAmountText] = useState(() =>
    initial ? formatNumber(initial.amount) : "",
  );
  const [occurredDate, setOccurredDate] = useState<Date>(() =>
    initial ? parseStoredDate(initial.occurredOn) : parseDefaultDate(defaultDate),
  );
  const [memoText, setMemoText] = useState(() => initial?.memo ?? "");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deletePending, setDeletePending] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const busy = pending || deletePending;

  const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
  const canSubmit = amountValue > 0 && !busy;

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Calendar disables dates outside the visible cycle AND future dates.
  // `cycleEnd` is exclusive (one past the last day) so the range check
  // uses `< cycleEnd`. Comparisons all happen at local-midnight to avoid
  // hour-of-day drift confusing the boundary.
  function isDateDisabled(date: Date): boolean {
    const startTs = new Date(
      cycleStart.getFullYear(),
      cycleStart.getMonth(),
      cycleStart.getDate(),
    ).getTime();
    const endTs = new Date(
      cycleEnd.getFullYear(),
      cycleEnd.getMonth(),
      cycleEnd.getDate(),
    ).getTime();
    const target = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime();
    if (target < startTs || target >= endTs) return true;
    const today = new Date();
    const todayMid = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    if (target > todayMid) return true;
    return false;
  }

  function focusAmountInput() {
    const el = amountInputRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }

  function handleQuickAdd(value: number) {
    setAmountText((prev) => formatNumber(parseAmountInput(prev) + value));
  }

  function handleClearAmount() {
    setAmountText("");
  }

  function handleAmountChange(event: React.ChangeEvent<HTMLInputElement>) {
    setAmountText(formatAmountInput(event.target.value));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    if (initial) {
      startTransition(async () => {
        const result = await updateIncomeAdjustmentAction({
          id: initial.id,
          amount: amountValue,
          occurredOn: toISODate(occurredDate),
          memo: memoText,
        });
        if (result.ok) {
          toast.success("추가 수입 수정됐어요.");
          onSaved();
        } else {
          toast.error(result.error);
        }
      });
      return;
    }

    startTransition(async () => {
      const result = await addIncomeAdjustmentAction({
        amount: amountValue,
        occurredOn: toISODate(occurredDate),
        memo: memoText,
      });
      if (result.ok) {
        const inserted = result.id;
        // Five-second undo via sonner's `action` button. Now that an edit
        // surface exists, this is a quick safety net rather than the only
        // recovery path.
        toast.success("추가 수입 등록됐어요.", {
          duration: 5000,
          action: {
            label: "취소",
            onClick: () => {
              void (async () => {
                const del = await deleteIncomeAdjustmentAction(inserted);
                if (del.ok) toast.success("취소됐어요.");
                else toast.error(del.error);
              })();
            },
          },
        });
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (!initial) return;
    setDeletePending(true);
    void (async () => {
      const result = await deleteIncomeAdjustmentAction(initial.id);
      setDeletePending(false);
      if (result.ok) {
        toast.success("삭제됐어요.");
        setConfirmDeleteOpen(false);
        onSaved();
      } else {
        toast.error(result.error);
      }
    })();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <label className="block px-1 text-sm font-medium text-muted-foreground">
          수입 금액
        </label>
        <div
          role="presentation"
          onClick={focusAmountInput}
          className="relative cursor-text space-y-4 rounded-2xl bg-muted px-4 pb-4 pt-6"
        >
          {amountValue > 0 ? (
            <div className="absolute right-3 top-3 flex gap-1.5">
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
            </div>
          ) : null}
          <div className="flex items-baseline justify-center gap-2">
            <input
              ref={amountInputRef}
              inputMode="numeric"
              aria-label="수입 금액"
              value={amountText}
              onChange={handleAmountChange}
              placeholder="0"
              className="min-w-[1ch] bg-transparent text-right text-[40px] font-bold tracking-[-0.045em] tabular-nums outline-none [field-sizing:content]"
            />
            <span className="text-[22px] font-semibold text-muted-foreground">
              원
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {QUICK_AMOUNTS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleQuickAdd(value);
                }}
                className="h-8 rounded-full bg-card text-xs font-medium tabular-nums shadow-sm transition-all duration-150 ease-out hover:bg-background active:scale-[0.98]"
              >
                +{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block px-1 text-xs font-medium text-muted-foreground">
          상세 정보
        </label>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-3 px-4">
            <Pencil
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <input
              type="text"
              aria-label="메모"
              value={memoText}
              onChange={(event) =>
                setMemoText(event.target.value.slice(0, MEMO_MAX_LENGTH))
              }
              maxLength={MEMO_MAX_LENGTH}
              placeholder="메모 추가 (선택)"
              className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60"
            />
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">
              {memoText.length}/{MEMO_MAX_LENGTH}
            </span>
          </div>

          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger
              type="button"
              className="flex h-12 w-full items-center gap-3 px-4 text-left outline-none transition-colors hover:bg-muted/60"
            >
              <CalendarIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="flex-1 text-[15px] font-medium">
                {formatKoreanFullDate(occurredDate)}
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 [&_button]:pointer-events-auto [&_input]:pointer-events-auto"
              align="start"
            >
              <Calendar
                mode="single"
                selected={occurredDate}
                onSelect={(date) => {
                  if (date) {
                    setOccurredDate(new Date(date));
                    setDatePickerOpen(false);
                  }
                }}
                disabled={isDateDisabled}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {isEdit && initial ? (
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
      ) : (
        <Button
          type="submit"
          disabled={!canSubmit}
          className="h-12 w-full rounded-full text-[15px] font-semibold"
        >
          {pending ? "추가 중…" : "추가하기"}
        </Button>
      )}

      {isEdit && initial ? (
        <AlertDialog
          open={confirmDeleteOpen}
          onOpenChange={(open) => {
            if (!deletePending) setConfirmDeleteOpen(open);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>이 추가 수입을 삭제할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                삭제한 추가 수입은 합계에서 즉시 사라져요.
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
      ) : null}
    </form>
  );
}
