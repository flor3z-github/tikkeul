"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CalendarIcon,
  Check,
  ChevronRight,
  Pencil,
  Trash2,
  Undo2,
  Users,
  X,
} from "lucide-react";
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
  DrawerNestedRoot,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/lib/utils/category-icon";
import { formatKoreanFullDate, toISODate } from "@/lib/utils/date";
import { formatNumber, parseAmountInput } from "@/lib/utils/money";
import type { TransactionVisibility } from "@/lib/queries/transactions";

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
  color: string | null;
};

export type TransactionFormInitial = {
  id: string;
  amount: number;
  category_id: string | null;
  spent_at: string;
  memo: string | null;
  visibility: TransactionVisibility;
  visible_group_ids: string[];
};

export type TransactionFormGroup = {
  id: string;
  name: string;
  isSeed: boolean;
  members: { id: string; nickname: string }[];
};

// Selector state. Mirrors the DB enum verbatim — `groups` carries an
// accompanying `selectedGroupIds` array; the other two values ignore it.
type VisibilityChoice = "all" | "groups" | "private";

const MEMO_MAX_LENGTH = 100;

type TransactionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: TransactionFormCategory[];
  initial?: TransactionFormInitial | null;
  /** YYYY-MM-DD. Initial date for create mode; ignored in edit mode. */
  defaultDate?: string;
  /** The viewer's friend groups (seed + user-defined). Phase 1/5 only
   *  exposes the seed group in the form; phase 6 turns the picker into a
   *  multi-checkbox over this whole array. */
  groups?: TransactionFormGroup[];
  onSaved?: () => void;
  /**
   * When true, render as a nested drawer (`DrawerNestedRoot`) so vaul scales
   * the parent sheet and the iOS keyboard handler runs at this level too.
   * Used when this dialog is opened from inside another open BottomSheet
   * (e.g. the transaction interaction sheet's "수정" button).
   */
  nested?: boolean;
};

export function TransactionFormDialog({
  open,
  onOpenChange,
  categories,
  initial,
  defaultDate,
  groups,
  onSaved,
  nested = false,
}: TransactionFormDialogProps) {
  const Root = nested ? DrawerNestedRoot : Drawer;
  return (
    <Root open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-white/10 bg-background px-5 pb-8 pt-4">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{initial ? "소비 수정" : "소비 추가"}</DrawerTitle>
          <DrawerDescription>
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
          groups={groups ?? []}
          onSaved={() => {
            onOpenChange(false);
            onSaved?.();
          }}
        />
      </DrawerContent>
    </Root>
  );
}

type FormBodyProps = {
  initial: TransactionFormInitial | null;
  categories: TransactionFormCategory[];
  defaultDate?: string;
  groups: TransactionFormGroup[];
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
  if (!fromDefault) return new Date();
  return fromDefault;
}

function deriveInitialVisibilityChoice(
  initial: TransactionFormInitial | null,
): VisibilityChoice {
  if (!initial) return "all";
  if (initial.visibility === "private") return "private";
  if (initial.visibility === "groups") return "groups";
  return "all";
}

// Filter the row's stored group ids down to the ones that still exist among
// the viewer's current groups. Deleted groups are silently dropped — the
// 0044 cascade trigger has already migrated truly orphaned rows to 'private',
// so any leftover ids here are stale references the user can re-pick.
function deriveInitialSelectedGroupIds(
  initial: TransactionFormInitial | null,
  groups: TransactionFormGroup[],
): string[] {
  if (!initial || initial.visibility !== "groups") return [];
  const valid = new Set(groups.map((g) => g.id));
  return initial.visible_group_ids.filter((id) => valid.has(id));
}

function TransactionFormBody({
  initial,
  categories,
  defaultDate,
  groups,
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
  const [memoText, setMemoText] = useState(() => initial?.memo ?? "");
  const [visibilityChoice, setVisibilityChoice] = useState<VisibilityChoice>(
    () => deriveInitialVisibilityChoice(initial),
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() =>
    deriveInitialSelectedGroupIds(initial, groups),
  );
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  // Stack of quick-amount additions for the undo (←) button. Cleared whenever
  // the amount is reset or edited manually so the history can't lie.
  const [quickHistory, setQuickHistory] = useState<number[]>([]);

  const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
  const busy = pending || deletePending;
  // The 'groups' choice requires at least one selected group — submitting
  // an empty list would silently make the row no-one-visible. Block it here
  // so the user has to either pick a group or switch to 'private'.
  const groupsChoiceReady =
    visibilityChoice !== "groups" || selectedGroupIds.length > 0;
  const canSubmit =
    amountValue > 0 && categoryId !== null && groupsChoiceReady && !busy;
  const amountInputRef = useRef<HTMLInputElement>(null);

  const groupsAvailable = groups.length > 0;

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

  function handleSelectVisibility(next: VisibilityChoice) {
    if (next === "groups" && !groupsAvailable) return;
    setVisibilityChoice(next);
    // Auto-open the picker when the user selects "부분 공개" with nothing
    // chosen yet — saves a tap and makes the requirement obvious.
    if (next === "groups" && selectedGroupIds.length === 0) {
      setGroupPickerOpen(true);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const visibility: TransactionVisibility = visibilityChoice;
    const groupIds = visibilityChoice === "groups" ? selectedGroupIds : null;

    startTransition(async () => {
      const result = await submitTransactionAction({
        id: initial?.id,
        amount: amountValue,
        categoryId,
        spentAt: toISODate(spentDate),
        memo: memoText,
        visibility,
        groupIds,
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
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <label className="block px-1 text-sm font-medium text-muted-foreground">
          지출 금액
        </label>
        <div
          role="presentation"
          onClick={focusAmountInput}
          className="relative cursor-text space-y-4 rounded-2xl bg-muted px-4 pb-4 pt-6"
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
            aria-label="지출 금액"
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
          카테고리
        </label>
        <div
          ref={categoryScrollRef}
          role="group"
          aria-label="카테고리"
          className="flex gap-2 overflow-x-auto pb-1"
          style={{
            scrollbarWidth: "none",
            maskImage: categoryFadeMask,
            WebkitMaskImage: categoryFadeMask,
          }}
        >
          {categories.map((category) => {
            const selected = category.id === categoryId;
            const tint = category.color;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-all duration-150 ease-out",
                  "active:scale-[0.98]",
                  selected
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                <CategoryIcon
                  slug={category.icon}
                  className="size-3.5"
                  style={!selected && tint ? { color: tint } : undefined}
                />
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block px-1 text-xs font-medium text-muted-foreground">
          상세 정보
        </label>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-3 px-4">
          <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            id="transaction-memo"
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
              {formatKoreanFullDate(spentDate)}
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
              selected={spentDate}
              onSelect={(date) => {
                if (date) {
                  setSpentDate(new Date(date));
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

        <VisibilitySelector
          value={visibilityChoice}
          onChange={handleSelectVisibility}
          selectedGroupCount={selectedGroupIds.length}
          groupsAvailable={groupsAvailable}
          onOpenGroupPicker={() => setGroupPickerOpen(true)}
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

      <GroupPickerDrawer
        open={groupPickerOpen}
        onOpenChange={setGroupPickerOpen}
        groups={groups}
        selectedIds={selectedGroupIds}
        onChange={setSelectedGroupIds}
      />
    </form>
  );
}

type VisibilitySelectorProps = {
  value: VisibilityChoice;
  onChange: (next: VisibilityChoice) => void;
  selectedGroupCount: number;
  groupsAvailable: boolean;
  onOpenGroupPicker: () => void;
};

const VISIBILITY_SEGMENTS: { value: VisibilityChoice; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "groups", label: "부분" },
  { value: "private", label: "비공개" },
];

function VisibilitySelector({
  value,
  onChange,
  selectedGroupCount,
  groupsAvailable,
  onOpenGroupPicker,
}: VisibilitySelectorProps) {
  const description =
    value === "all"
      ? "모든 친구가 이 소비를 볼 수 있어요."
      : value === "private"
        ? "친구에게 비공개예요. 합계에서도 빠져요."
        : !groupsAvailable
          ? "그룹을 먼저 만들어주세요."
          : selectedGroupCount === 0
            ? "공개할 그룹을 선택해주세요."
            : `선택한 ${selectedGroupCount}개 그룹의 친구에게만 보여요.`;

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <Users
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="text-xs font-medium text-muted-foreground">
          공개 범위
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label="공개 범위"
        className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1"
      >
        {VISIBILITY_SEGMENTS.map((segment) => {
          const selected = segment.value === value;
          const disabled = segment.value === "groups" && !groupsAvailable;
          return (
            <button
              key={segment.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onChange(segment.value);
              }}
              className={cn(
                "h-9 rounded-full text-[13px] font-medium transition-all duration-150 ease-out",
                "active:scale-[0.98]",
                selected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background",
                disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
              )}
            >
              {segment.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] leading-snug text-muted-foreground">
          {description}
          {!groupsAvailable && value === "groups" ? (
            <>
              {" "}
              <Link
                href="/friends/groups"
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                그룹 관리
              </Link>
            </>
          ) : null}
        </p>
        {value === "groups" && groupsAvailable ? (
          <button
            type="button"
            aria-label="그룹 선택"
            onClick={onOpenGroupPicker}
            className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <Users className="size-3.5" aria-hidden />
            <span>{selectedGroupCount}개 그룹</span>
            <ChevronRight className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

type GroupPickerDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: TransactionFormGroup[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
};

// Buffer model: changes inside the drawer are kept in a local `buffer` and
// only flushed to the parent when the user taps the primary commit button.
// Dismissing via overlay tap, swipe-down, or the X button reverts to whatever
// the parent already had. The buffer reseeds on every false→true transition
// of `open` so reopening discards any unsubmitted edits from a prior session.
function GroupPickerDrawer({
  open,
  onOpenChange,
  groups,
  selectedIds,
  onChange,
}: GroupPickerDrawerProps) {
  const [buffer, setBuffer] = useState<string[]>(selectedIds);
  const [lastOpenSeen, setLastOpenSeen] = useState(open);

  // React-recommended "adjust state when a prop changes" pattern. Reseed
  // the buffer at the moment the drawer transitions to open so the user
  // sees the current parent state, not a stale buffer from earlier.
  if (open !== lastOpenSeen) {
    setLastOpenSeen(open);
    if (open) setBuffer(selectedIds);
  }

  const bufferSet = useMemo(() => new Set(buffer), [buffer]);

  function toggle(groupId: string) {
    if (bufferSet.has(groupId)) {
      setBuffer(buffer.filter((id) => id !== groupId));
    } else {
      setBuffer([...buffer, groupId]);
    }
  }

  function commit() {
    onChange(buffer);
    onOpenChange(false);
  }

  // Commit button label: list up to 2 selected names, then "외 N개" for the
  // rest. Names follow the groups array order, which is already seed-first
  // sorted by the calendar section.
  const selectedGroupRows = groups.filter((g) => bufferSet.has(g.id));
  const selectedNames = selectedGroupRows.map((g) => g.name);
  const namePreview =
    selectedNames.length <= 2
      ? selectedNames.join(", ")
      : `${selectedNames[0]}, ${selectedNames[1]} 외 ${selectedNames.length - 2}개`;
  const hasSelection = buffer.length > 0;

  return (
    <DrawerNestedRoot open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-white/10 bg-background px-5 pb-8 pt-2">
        <DrawerHeader className="px-0 pb-3 pt-2 text-left">
          <DrawerTitle className="text-[20px] font-bold tracking-[-0.025em]">
            그룹 선택
          </DrawerTitle>
          <DrawerDescription className="text-[13px] text-muted-foreground">
            선택한 그룹의 친구에게만 이 소비가 보여요.
          </DrawerDescription>
        </DrawerHeader>

        {groups.length === 0 ? (
          <p className="rounded-2xl bg-muted px-4 py-6 text-center text-[13px] text-muted-foreground">
            아직 그룹이 없어요.
          </p>
        ) : (
          <ul className="space-y-1">
            {groups.map((group) => {
              const checked = bufferSet.has(group.id);
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => toggle(group.id)}
                    aria-pressed={checked}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors",
                      checked ? "bg-secondary" : "hover:bg-muted",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-[15px] font-medium">
                        {group.name}
                      </span>
                      {group.isSeed ? (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          기본
                        </span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                        <Users className="size-3.5" aria-hidden />
                        {group.members.length}명
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full border",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40",
                        )}
                      >
                        {checked ? <Check className="size-3.5" /> : null}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 text-[12px] leading-snug text-muted-foreground/80">
          그룹과 친구는{" "}
          <Link
            href="/friends/groups"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            그룹 관리
          </Link>
          에서 편집할 수 있어요.
        </p>

        {hasSelection ? (
          <Button
            type="button"
            onClick={commit}
            className="mt-6 h-12 w-full rounded-full text-[15px] font-semibold"
          >
            {namePreview} 추가
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="mt-6 h-12 w-full rounded-full text-[15px] font-semibold"
          >
            닫기
          </Button>
        )}
      </DrawerContent>
    </DrawerNestedRoot>
  );
}
