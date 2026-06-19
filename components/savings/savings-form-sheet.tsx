"use client";

import { useMemo, useState, useTransition } from "react";
import { Calendar as CalendarIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addSavingsPlanAction,
  deleteSavingsPlanAction,
  updateSavingsPlanAction,
} from "@/app/savings/actions";
import { AmountInput } from "@/components/fixed-expenses/amount-input";
import { PaymentDaySelect } from "@/components/fixed-expenses/payment-day-select";
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
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatAmountInput, formatNumber, parseAmountInput } from "@/lib/utils/money";
import type { SavingsPlanRow } from "@/lib/utils/savings";

type SavingsFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass a plan to edit; omit/null to create. */
  initial?: SavingsPlanRow | null;
  /** Today's date 'YYYY-MM-DD' (server-resolved KST) for the start-date default. */
  todayISO: string;
};

export function SavingsFormSheet({
  open,
  onOpenChange,
  initial,
  todayISO,
}: SavingsFormSheetProps) {
  const editing = initial != null;
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "수정" : "돈모으기 추가"}
      description={
        editing
          ? "적금·투자 항목을 수정하거나 삭제합니다."
          : "매달 모으는 적금·투자 항목을 추가합니다."
      }
    >
      {/* Keyed by id (or "new") so each open mounts fresh state. */}
      <SavingsFormBody
        key={initial?.id ?? "new"}
        initial={initial ?? null}
        todayISO={todayISO}
        onDone={() => onOpenChange(false)}
      />
    </BottomSheet>
  );
}

function SavingsFormBody({
  initial,
  todayISO,
  onDone,
}: {
  initial: SavingsPlanRow | null;
  todayISO: string;
  onDone: () => void;
}) {
  const editing = initial != null;
  const [name, setName] = useState(initial?.name ?? "");
  const [amountText, setAmountText] = useState(
    initial?.amount != null ? formatNumber(initial.amount) : "",
  );
  const [paymentDay, setPaymentDay] = useState<number | null>(
    initial?.payment_day ?? null,
  );
  const [startDate, setStartDate] = useState(initial?.start_date ?? todayISO);
  const [openingText, setOpeningText] = useState(
    initial && initial.opening_balance > 0
      ? formatNumber(initial.opening_balance)
      : "",
  );
  const [goalText, setGoalText] = useState(
    initial?.goal_amount != null ? formatNumber(initial.goal_amount) : "",
  );
  const [maturityDate, setMaturityDate] = useState(initial?.maturity_date ?? "");

  const [savePending, startSaveTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
  const goalValue = useMemo(() => parseAmountInput(goalText), [goalText]);
  const openingValue = useMemo(() => parseAmountInput(openingText), [openingText]);
  const amountIsEmpty = amountText.trim().length === 0;
  const goalIsEmpty = goalText.trim().length === 0;
  const openingIsEmpty = openingText.trim().length === 0;
  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && startDate.length > 0 && !savePending;

  // A goal_amount or a maturity_date promotes the item to a 달성형 목표.
  const isGoalLike = !goalIsEmpty || maturityDate.length > 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const payload = {
      name: trimmedName,
      amount: amountIsEmpty ? null : amountValue,
      payment_day: paymentDay,
      start_date: startDate,
      opening_balance: openingIsEmpty ? null : openingValue,
      goal_amount: goalIsEmpty ? null : goalValue,
      maturity_date: maturityDate.length > 0 ? maturityDate : null,
    };

    startSaveTransition(async () => {
      const result = editing
        ? await updateSavingsPlanAction({ id: initial.id, ...payload })
        : await addSavingsPlanAction(payload);
      if (result.ok) {
        toast.success(editing ? "수정됐어요." : "추가됐어요.");
        onDone();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (!initial) return;
    setConfirmDeleteOpen(false);
    startDeleteTransition(async () => {
      const result = await deleteSavingsPlanAction(initial.id);
      if (result.ok) {
        toast.success("삭제됐어요.");
        onDone();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="savings-name"
          className="block text-sm font-medium text-muted-foreground"
        >
          이름
        </label>
        <input
          id="savings-name"
          type="text"
          autoComplete="off"
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="예: 청년희망적금, ISA 투자, 비상금"
          className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] outline-none placeholder:text-muted-foreground focus:border-ring"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted-foreground">
          월 적립액 <span className="text-muted-foreground/70">(선택)</span>
        </label>
        <AmountInput value={amountText} onChange={setAmountText} />
        <p className="px-1 text-[12px] text-muted-foreground">
          매달 모으는 금액이에요. 모은 돈은 적립액으로 계산돼요.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="savings-opening"
          className="block text-sm font-medium text-muted-foreground"
        >
          지금까지 모은 돈 <span className="text-muted-foreground/70">(선택)</span>
        </label>
        <SmallAmountInput
          id="savings-opening"
          value={openingText}
          onChange={setOpeningText}
        />
        <p className="px-1 text-[12px] text-muted-foreground">
          이미 모아둔 게 있으면 입력하세요. 시작일을 몰라도 돼요 — 시작일은 오늘로
          두면 여기 입력한 금액부터 매달 늘어나요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-2">
          <label
            htmlFor="savings-payment-day"
            className="block text-sm font-medium text-muted-foreground"
          >
            적립일 <span className="text-muted-foreground/70">(선택)</span>
          </label>
          <PaymentDaySelect
            id="savings-payment-day"
            value={paymentDay}
            onChange={setPaymentDay}
          />
        </div>
        <div className="min-w-0 space-y-2">
          <label
            htmlFor="savings-start-date"
            className="block text-sm font-medium text-muted-foreground"
          >
            시작일
          </label>
          <DateField
            id="savings-start-date"
            value={startDate}
            onChange={setStartDate}
          />
        </div>
      </div>

      {/* Optional goal / maturity — setting either makes this a 달성형 목표.
          Kept at the same level as 적립일/시작일 (no grouping box); the caption
          hugs the grid like the monthly field's hint. */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="savings-goal"
              className="block text-sm font-medium text-muted-foreground"
            >
              목표 금액 <span className="text-muted-foreground/70">(선택)</span>
            </label>
            <SmallAmountInput
              id="savings-goal"
              value={goalText}
              onChange={setGoalText}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="savings-maturity"
              className="block text-sm font-medium text-muted-foreground"
            >
              만기일 <span className="text-muted-foreground/70">(선택)</span>
            </label>
            <DateField
              id="savings-maturity"
              value={maturityDate}
              onChange={setMaturityDate}
            />
          </div>
        </div>
        <p className="px-1 text-[12px] text-muted-foreground">
          {isGoalLike
            ? "달성형 목표로 표시돼요."
            : "목표 금액이나 만기일을 정하면 달성형 목표로 진행률이 표시돼요."}
        </p>
      </div>

      {editing ? (
        <div className="grid grid-cols-4 gap-2">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="col-span-3 h-12 rounded-full text-[15px] font-semibold"
          >
            {savePending ? "수정 중…" : "수정하기"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={deletePending}
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
          {savePending ? "추가 중…" : "추가하기"}
        </Button>
      )}

      {editing ? (
        <AlertDialog
          open={confirmDeleteOpen}
          onOpenChange={(open) => {
            if (!deletePending) setConfirmDeleteOpen(open);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>이 항목을 삭제할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                모은 돈 합계에서도 즉시 빠져요.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletePending}>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  handleDelete();
                }}
                disabled={deletePending}
                className={buttonVariants({ variant: "destructive" })}
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

// Open the OS-native date picker on tap anywhere in the field. On iOS Safari /
// Samsung Internet a tap already opens it; this also covers desktop Chrome,
// where only the calendar icon would otherwise trigger it. showPicker() must
// run inside a user gesture (onClick qualifies); guard for unsupported engines.
function openNativePicker(event: React.MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker?.();
  } catch {
    // Unsupported / blocked — native tap-to-open still works on mobile.
  }
}

/**
 * Native `<input type="date">` in a 2-col grid cell.
 *
 * iOS Safari does NOT honor `min-width:0`/`width:100%` on a native date input —
 * the control keeps its intrinsic min-width and overflows the narrow cell,
 * shoving its right edge (and the calendar icon) off-screen. `appearance-none`
 * (+ the `-webkit-` fallback for older iOS) strips that native min-width so the
 * input lays out like the text/amount inputs that already fit in this grid.
 * Since `appearance-none` also kills the engine's own picker indicator, we hide
 * the leftover Chrome `::-webkit-calendar-picker-indicator` and render a custom
 * lucide icon — so the icon shows consistently on iOS *and* Chrome. The icon is
 * `pointer-events-none` so taps fall through to the input (which opens the
 * native picker; `onClick` also calls `showPicker()` for desktop).
 */
function DateField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={openNativePicker}
        className="h-12 w-full min-w-0 appearance-none rounded-2xl border border-border bg-card pl-4 pr-10 text-[15px] outline-none [-webkit-appearance:none] focus:border-ring [&::-webkit-calendar-picker-indicator]:hidden"
      />
      <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/** Compact right-aligned amount field for the optional goal amount. */
function SmallAmountInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex h-12 items-center gap-1 rounded-2xl border border-border bg-card px-4">
      <input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(formatAmountInput(event.target.value))}
        placeholder="0"
        className="min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground"
      />
      <span className="text-[14px] font-medium text-muted-foreground">원</span>
    </div>
  );
}
