"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  CalendarIcon,
  Check,
  ChevronRight,
  CreditCard,
  Layers,
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerNestedRoot,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { SplitChips } from "@/components/fixed-expenses/split-chips";
import { CategoryIcon } from "@/lib/utils/category-icon";
import {
  CategoryPickerDrawer,
  type CategoryMutation,
} from "@/components/transactions/category-picker-drawer";
import { toISODate } from "@/lib/utils/date";
import {
  formatAmountInput,
  formatNumber,
  parseAmountInput,
} from "@/lib/utils/money";
import type { TransactionVisibility } from "@/lib/queries/transactions";
import {
  PAYMENT_METHOD_LABELS,
  isPaymentMethod,
  type PaymentMethod,
} from "@/lib/utils/payment-method";

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
  /** True for per-user custom categories (editable/deletable in the picker),
   *  false/undefined for shared seeds (locked). Optional so existing call
   *  sites that don't set it keep treating rows as seeds. */
  isCustom?: boolean;
};

export type TransactionFormInitial = {
  id: string;
  amount: number;
  category_id: string | null;
  spent_at: string;
  memo: string | null;
  payment_method: PaymentMethod | null;
  installment_id: string | null;
  installment_seq: number | null;
  installment_count: number | null;
  split_count: number | null;
  split_total: number | null;
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

// 'create' defaults the 결제수단 to the user's last-used method (persisted),
// not a fixed value — persisting the last pick keeps the /stats credit/check
// ratio honest for repeat users. The cold-start fallback (no saved value yet)
// is 'debit' (체크): most everyday spending is on a check card, so it's the
// safer neutral seed than credit. Edit mode ignores this and prefills from the
// row instead. Read lazily inside the (client-only) form body initializer; the
// drawer body only mounts on open so there's no SSR subtree to mismatch.
const LAST_PAYMENT_METHOD_KEY = "tikkeul:last-payment-method";

function readLastPaymentMethod(): PaymentMethod {
  if (typeof window === "undefined") return "debit";
  const saved = window.localStorage.getItem(LAST_PAYMENT_METHOD_KEY);
  return isPaymentMethod(saved) ? saved : "debit";
}

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
};

export function TransactionFormDialog({
  open,
  onOpenChange,
  categories,
  initial,
  defaultDate,
  groups,
  onSaved,
}: TransactionFormDialogProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
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
    </Drawer>
  );
}

type FormBodyProps = {
  initial: TransactionFormInitial | null;
  categories: TransactionFormCategory[];
  defaultDate?: string;
  groups: TransactionFormGroup[];
  onSaved: () => void;
};

// Lenient 'YYYY-MM-DD' → local-midnight Date (no future check). Parsed by
// components, NOT `new Date(string)`, so it stays on the wall-clock day.
// Used by the date input's onChange so EVERY valid pick updates the field —
// rejecting a value there would leave the controlled input stuck on its prior
// value (the "date won't change" bug). The picker is bounded by `max` instead.
function parseISODate(value: string | undefined): Date | null {
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
  return dt;
}

// The incoming `defaultDate` prop must never seed a future spending date, so
// this layer adds the future rejection on top of the lenient parse.
function parseDefaultDate(value: string | undefined): Date | null {
  const dt = parseISODate(value);
  if (!dt) return null;
  if (dt.getTime() > Date.now()) return null;
  return dt;
}

function pickCreateDefaultDate(defaultDate: string | undefined): Date {
  const fromDefault = parseDefaultDate(defaultDate);
  if (!fromDefault) return new Date();
  return fromDefault;
}

// Open the OS-native date picker on tap. iOS/Samsung open it on tap already;
// since we hide the engine's own picker indicator, this also covers desktop
// (showPicker() must run inside a user gesture — onClick qualifies).
function openNativePicker(event: React.MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker?.();
  } catch {
    // Unsupported / blocked — native tap-to-open still works on mobile.
  }
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
  categories: initialCategories,
  defaultDate,
  groups,
  onSaved,
}: FormBodyProps) {
  const mode = initial ? "edit" : "create";
  const router = useRouter();

  // Local category list seeded from the prop so create/update/delete inside
  // the picker reflect immediately without waiting for the server round-trip.
  // `router.refresh()` (fired alongside the action's revalidatePath) resyncs
  // the persisted order on the next render.
  const [categories, setCategories] =
    useState<TransactionFormCategory[]>(initialCategories);

  const [amountText, setAmountText] = useState(() =>
    initial ? formatNumber(Number(initial.amount)) : "",
  );
  const [categoryId, setCategoryId] = useState<string | null>(() =>
    initial ? initial.category_id : (categories[0]?.id ?? null),
  );
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [spentDate, setSpentDate] = useState<Date>(() => {
    if (initial) return new Date(initial.spent_at);
    return pickCreateDefaultDate(defaultDate);
  });
  const [memoText, setMemoText] = useState(() => initial?.memo ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() =>
    initial ? (initial.payment_method ?? "debit") : readLastPaymentMethod(),
  );
  // 할부 개월. 1 = 일시불(단일 행). >=2 = 신용 할부. Create 모드 + 신용일 때만
  // 노출되고, 체크로 바꾸면 1로 리셋된다.
  const [installmentMonths, setInstallmentMonths] = useState<number>(1);
  // N명 나눠내기(정산). splitCount 1 = 안 나눔. >=2 = N명이 나눔 → amount칸엔 내 몫만
  // 담기고, splitTotal(총액)은 표시용으로 보관한다. 편집 진입 시 저장된 값으로 복원.
  const [splitCount, setSplitCount] = useState<number>(() =>
    initial?.split_count && initial.split_count >= 2 ? initial.split_count : 1,
  );
  const [splitTotal, setSplitTotal] = useState<number | null>(() =>
    initial?.split_count && initial.split_count >= 2
      ? (initial.split_total ?? null)
      : null,
  );
  // 나눠내기 인원 선택은 nested drawer(공개범위 「부분」의 GroupPickerDrawer와 동일
  // 패턴)로 처리해 폼 세로 길이를 늘리지 않는다. 트리거 행만 폼에 남는다.
  const [splitPickerOpen, setSplitPickerOpen] = useState(false);
  const [visibilityChoice, setVisibilityChoice] = useState<VisibilityChoice>(
    () => deriveInitialVisibilityChoice(initial),
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() =>
    deriveInitialSelectedGroupIds(initial, groups),
  );
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  // Stack of quick-amount additions for the undo (←) button. Cleared whenever
  // the amount is reset or edited manually so the history can't lie.
  const [quickHistory, setQuickHistory] = useState<number[]>([]);

  const amountValue = useMemo(() => parseAmountInput(amountText), [amountText]);
  // 나누기 기준 총액. 나눈 상태면 저장된 총액(splitTotal), 아니면 지금 입력값 자체가
  // "총액 후보"다 — 인원 칩을 누르면 이 값을 총액으로 삼아 내 몫으로 쪼갠다.
  const splitBaseAmount = splitCount > 1 ? (splitTotal ?? amountValue) : amountValue;
  // 할부와 나눠내기는 상호배타(v1). 할부는 create+신용일 때만.
  const installmentActive =
    mode === "create" && paymentMethod === "credit" && installmentMonths >= 2;
  const busy = pending || deletePending;
  // The 'groups' choice requires at least one selected group — submitting
  // an empty list would silently make the row no-one-visible. Block it here
  // so the user has to either pick a group or switch to 'private'.
  const groupsChoiceReady =
    visibilityChoice !== "groups" || selectedGroupIds.length > 0;
  const canSubmit =
    amountValue > 0 && categoryId !== null && groupsChoiceReady && !busy;
  const amountInputRef = useRef<HTMLInputElement>(null);
  const memoInputRef = useRef<HTMLInputElement>(null);

  const groupsAvailable = groups.length > 0;

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );

  // Apply a create/update/delete from the picker to the local category list
  // and keep the form's selection coherent (a deleted selection falls back to
  // the first remaining category). `router.refresh()` resyncs persisted order.
  function handleCategoryMutated(op: CategoryMutation) {
    if (op.type === "create") {
      setCategories((prev) => [...prev, op.category]);
    } else if (op.type === "update") {
      setCategories((prev) =>
        prev.map((c) => (c.id === op.category.id ? op.category : c)),
      );
    } else {
      const deletedId = op.id;
      setCategories((prev) => prev.filter((c) => c.id !== deletedId));
      if (categoryId === deletedId) {
        // Fall back to the first remaining category. Resolve against the
        // current list minus the deleted row so we don't pick the dead id.
        const remaining = categories.filter((c) => c.id !== deletedId);
        setCategoryId(remaining[0]?.id ?? null);
      }
    }
    router.refresh();
  }

  function focusAmountInput() {
    const el = amountInputRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }

  // Memo is the only mid-sheet text input. When it gets focus the iOS soft
  // keyboard opens and covers it: DrawerContent clamps the sheet to the
  // visualViewport height, but the memo sits in the middle of the scroll body
  // and iOS's native "scroll focused input into view" can't move a
  // position:fixed sheet's inner scroller. Scroll it into the visible area
  // ourselves, after the keyboard inset has settled (mirrors DrawerContent's
  // rAF + ~300ms timing so we run once the sheet is resized).
  function handleMemoFocus() {
    const reveal = () =>
      memoInputRef.current?.scrollIntoView({ block: "center" });
    requestAnimationFrame(reveal);
    setTimeout(reveal, 350);
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
    setAmountText(formatAmountInput(event.target.value));
    // Manual edits make the quick-add history unreliable — drop it.
    setQuickHistory([]);
    // 금액을 직접 고치면 "총액/N" 분할 관계가 깨진다 — 분할 해제(수정된 값이 곧
    // 새 기준 총액이 된다). 편집 진입 초기 세팅(useState)엔 이 핸들러가 안 걸린다.
    if (splitCount > 1) {
      setSplitCount(1);
      setSplitTotal(null);
    }
  }

  // 인원 칩 선택. splitBaseAmount를 총액으로 삼아 내 몫(round)을 금액칸에 넣고,
  // 총액·인원은 표시/전송용 state로 보관한다. people=1(혼자 다)이면 분할 해제하고
  // 금액을 총액으로 복원한다.
  function handlePickSplit(next: number, people: number) {
    const base = splitBaseAmount;
    if (base <= 0) return;
    if (people <= 1) {
      setAmountText(formatNumber(base));
      setSplitCount(1);
      setSplitTotal(null);
    } else {
      setAmountText(formatNumber(next));
      setSplitCount(people);
      setSplitTotal(base);
    }
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
        paymentMethod,
        // 나눠내기가 켜져 있으면 할부는 강제로 일시불(상호배타 — 서버도 막지만
        // 클라이언트에서 먼저 정리).
        installmentMonths:
          paymentMethod === "credit" && splitCount < 2 ? installmentMonths : 1,
        splitCount: splitCount >= 2 ? splitCount : null,
        splitTotal: splitCount >= 2 ? splitTotal : null,
        visibility,
        groupIds,
      });
      if (result.ok) {
        // Remember the chosen method so the next 'create' defaults to it.
        // Create-only: editing an old row (esp. a legacy null → 'credit') must
        // not hijack the next new-purchase default.
        if (mode === "create" && typeof window !== "undefined") {
          window.localStorage.setItem(LAST_PAYMENT_METHOD_KEY, paymentMethod);
        }
        toast.success(mode === "edit" ? "수정됐어요." : "추가됐어요.");
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  }

  // 할부 자식 거래 편집: 개별 회차 수정은 합을 깨므로 막고(전체삭제만 v1), 정보 +
  // "할부 전체 삭제"만 보여준다. 삭제 액션(deleteTransactionAction)은 installment_id를
  // 보고 그룹 전체를 소프트삭제한다.
  if (mode === "edit" && initial?.installment_id) {
    return (
      <div className="space-y-4 pt-4">
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Layers
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="text-sm font-medium text-muted-foreground">
              할부 거래
            </span>
          </div>
          <p className="text-[15px] font-medium">
            {selectedCategory?.name ?? "기타"} · {initial.installment_count}개월
            할부 중 {initial.installment_seq}회차
          </p>
          <p className="text-[13px] leading-snug text-muted-foreground">
            이 회차 {formatNumber(initial.amount)}원. 할부는 회차별 수정이 안 돼요 —
            바꾸려면 전체 삭제 후 다시 등록해주세요.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={busy}
          className="h-12 w-full rounded-full text-[15px] font-semibold"
        >
          할부 전체 삭제
        </Button>
        <AlertDialog
          open={confirmDeleteOpen}
          onOpenChange={(open) => {
            if (!deletePending) setConfirmDeleteOpen(open);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>이 할부를 삭제할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                {initial.installment_count}개월 모든 회차가 목록과 합계에서
                사라져요.
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
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
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
        {/* N명 나눠내기(정산) 트리거. 금액을 쪼개는 동작이라 금액 카드 안에 인라인으로
            두어 폼 세로를 아낀다(단독 섹션 제거). 인원 칩은 SplitPickerDrawer가 담당.
            할부와 상호배타 — 할부 켜지면 숨긴다. stopPropagation: 카드 전체가
            focusAmountInput이라 탭이 새어나가면 안 된다. */}
        {!installmentActive ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSplitPickerOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-xl bg-card px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-background active:scale-[0.99]"
          >
            <Users
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            {splitCount > 1 && splitTotal ? (
              <span className="min-w-0 flex-1 truncate font-medium">
                {splitCount}명이 나눔 ·{" "}
                <span className="text-muted-foreground">
                  내 몫 {formatNumber(amountValue)}원
                </span>
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate font-medium text-muted-foreground">
                여러 명이 나눠 냈어요
              </span>
            )}
            <ChevronRight
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>
        ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block px-1 text-xs font-medium text-muted-foreground">
          카테고리
        </label>
        <button
          type="button"
          onClick={() => setCategoryPickerOpen(true)}
          className="flex h-14 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 text-left transition-colors hover:bg-muted/60 active:scale-[0.99]"
        >
          {selectedCategory ? (
            <>
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"
                style={
                  selectedCategory.color
                    ? { color: selectedCategory.color }
                    : undefined
                }
              >
                <CategoryIcon
                  slug={selectedCategory.icon}
                  className="size-4.5"
                />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                {selectedCategory.name}
              </span>
            </>
          ) : (
            <span className="min-w-0 flex-1 text-[15px] font-medium text-muted-foreground">
              카테고리 선택
            </span>
          )}
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </button>
      </div>

      <div className="space-y-2">
        <label className="block px-1 text-xs font-medium text-muted-foreground">
          상세 정보
        </label>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        <PaymentMethodSelector
          value={paymentMethod}
          onChange={(next) => {
            setPaymentMethod(next);
            // 체크는 할부 불가 — 일시불로 리셋.
            if (next !== "credit") setInstallmentMonths(1);
          }}
          showInstallment={
            mode === "create" && paymentMethod === "credit" && splitCount === 1
          }
          installmentMonths={installmentMonths}
          onInstallmentChange={setInstallmentMonths}
          principal={amountValue}
        />

        <div className="flex items-center gap-3 px-4">
          <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={memoInputRef}
            id="transaction-memo"
            type="text"
            aria-label="메모"
            value={memoText}
            onChange={(event) =>
              setMemoText(event.target.value.slice(0, MEMO_MAX_LENGTH))
            }
            onFocus={handleMemoFocus}
            maxLength={MEMO_MAX_LENGTH}
            placeholder="메모 추가 (선택)"
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60"
          />
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">
            {memoText.length}/{MEMO_MAX_LENGTH}
          </span>
        </div>

        {/* Native date input (matches the savings form). Lives as a row in
            the same divide-y card as the memo field. `appearance-none` lets
            iOS Safari honor the row width (native controls otherwise keep an
            intrinsic min-width); the engine's own indicator is hidden and the
            left CalendarIcon is the only icon. `max` blocks future dates the
            way the old Calendar's `disabled` did; parseDefaultDate re-rejects
            future/invalid values on change as a belt-and-suspenders guard. */}
        <div className="flex items-center gap-3 px-4">
          <CalendarIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <input
            id="transaction-date"
            type="date"
            aria-label="날짜"
            value={toISODate(spentDate)}
            max={toISODate(new Date())}
            onChange={(event) => {
              const next = parseISODate(event.target.value);
              if (next) setSpentDate(next);
            }}
            onClick={openNativePicker}
            className="h-12 min-w-0 flex-1 appearance-none bg-transparent text-[15px] font-medium outline-none [-webkit-appearance:none] [&::-webkit-calendar-picker-indicator]:hidden"
          />
        </div>

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

      <SplitPickerDrawer
        open={splitPickerOpen}
        onOpenChange={setSplitPickerOpen}
        baseAmount={splitBaseAmount}
        currentValue={amountValue}
        splitCount={splitCount}
        splitTotal={splitTotal}
        onPick={handlePickSplit}
      />

      <CategoryPickerDrawer
        open={categoryPickerOpen}
        onOpenChange={setCategoryPickerOpen}
        categories={categories}
        selectedId={categoryId}
        onSelect={setCategoryId}
        onMutated={handleCategoryMutated}
      />
    </form>
  );
}

const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 9, 12, 18, 24, 36];

type PaymentMethodSelectorProps = {
  value: PaymentMethod;
  onChange: (next: PaymentMethod) => void;
  /** create + 신용 + 비분할일 때만 할부 select를 이 행에 노출. */
  showInstallment: boolean;
  installmentMonths: number;
  onInstallmentChange: (months: number) => void;
  /** 원금 총액 — 월 부담 힌트 계산용. */
  principal: number;
};

// 토글 표시 순서(체크→신용). cold-start 기본값이 체크라 좌측에 둔다. 집계용
// PAYMENT_METHODS(credit→debit)와 분리 — /stats 버킷 순서는 건드리지 않는다.
const PAYMENT_METHOD_TOGGLE_ORDER: readonly PaymentMethod[] = ["debit", "credit"];

// 결제수단 2-세그먼트 토글 + (신용일 때) 할부 select를 한 행에 합쳐 세로를 아낀다
// (할부를 별도 행으로 두지 않는다). 결제수단은 2지선다라 버튼 토글이 빠르고, 할부는
// 옵션이 많아 네이티브 <select>(drawer 안 base-ui Select 금지 — [[select-in-drawer-portal-fix]]).
// 월 부담 힌트는 금액이 총 원금임을 알리려고 행 아래 조건부로 붙인다.
function PaymentMethodSelector({
  value,
  onChange,
  showInstallment,
  installmentMonths,
  onInstallmentChange,
  principal,
}: PaymentMethodSelectorProps) {
  const perMonth =
    installmentMonths >= 2 && principal >= installmentMonths
      ? Math.floor(principal / installmentMonths)
      : 0;
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <CreditCard
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          결제수단
        </span>
        <div
          role="radiogroup"
          aria-label="결제수단"
          className="ml-auto inline-flex gap-1 rounded-full bg-muted p-1"
        >
          {/* 토글 표시 순서만 체크→신용 (기본값 debit이 좌측). 집계용 전역
              PAYMENT_METHODS 순서(credit→debit, /stats도 씀)는 그대로 둔다. */}
          {PAYMENT_METHOD_TOGGLE_ORDER.map((method) => {
            const selected = method === value;
            return (
              <button
                key={method}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(method)}
                className={cn(
                  "h-8 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition-all duration-150 ease-out",
                  "active:scale-[0.98]",
                  selected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background",
                )}
              >
                {PAYMENT_METHOD_LABELS[method]}
              </button>
            );
          })}
        </div>
      </div>
      {/* 할부는 신용일 때만. 결제수단 토글과 같은 셀 안 둘째 줄에 둔다 — 좁은 폭
          (360px, iPhone SE 375px)에서 라벨+토글+select 3요소를 한 줄에 넣으면
          줄바꿈되기 때문. 체크(기본·대다수)는 이 줄이 없어 여전히 1줄이다. pl-7은
          아이콘(16)+gap(12)=28px라 「결제수단」 라벨과 세로 정렬을 맞춘다. */}
      {showInstallment ? (
        <div className="flex items-center gap-3">
          <span className="shrink-0 pl-7 text-xs font-medium text-muted-foreground">
            할부
          </span>
          <select
            aria-label="할부 개월"
            value={installmentMonths}
            onChange={(event) => onInstallmentChange(Number(event.target.value))}
            className="ml-auto appearance-none rounded-full bg-muted px-3 py-1.5 text-[13px] font-medium outline-none [-webkit-appearance:none]"
          >
            {INSTALLMENT_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === 1 ? "일시불" : `${m}개월`}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {showInstallment && installmentMonths >= 2 && perMonth > 0 ? (
        <p className="pl-7 text-[12px] leading-snug text-muted-foreground">
          월 약 {formatNumber(perMonth)}원 × {installmentMonths}개월 (첫 회차에
          우수리 포함)
        </p>
      ) : null}
    </div>
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
      {/* 세로 압축: 아이콘+라벨과 세그먼트를 한 행에 둔다(결제수단 행과 동일 인라인
          패턴). 세그먼트는 우측 정렬 pill. 설명줄은 아래 유지 — 비공개=합계 제외,
          부분=그룹 선택 안내는 프라이버시상 중요해 숨기지 않는다. */}
      <div className="flex items-center gap-3">
        <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium text-muted-foreground">
          공개 범위
        </span>
        <div
          role="radiogroup"
          aria-label="공개 범위"
          className="ml-auto inline-flex gap-1 rounded-full bg-muted p-1"
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
                  "h-8 rounded-full px-3 text-[13px] font-medium transition-all duration-150 ease-out",
                  "active:scale-[0.98]",
                  selected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background",
                  disabled &&
                    "cursor-not-allowed opacity-50 hover:bg-transparent",
                )}
              >
                {segment.label}
              </button>
            );
          })}
        </div>
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

type SplitPickerDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 나누기 기준 총액(splitBaseAmount). 0이면 아직 금액 미입력. */
  baseAmount: number;
  /** 금액칸 현재값 — 활성 칩 하이라이트에 쓴다. */
  currentValue: number;
  splitCount: number;
  splitTotal: number | null;
  /** (next, people) — SplitChips가 baseAmount/N과 선택 인원 N을 넘긴다. */
  onPick: (next: number, people: number) => void;
};

// N명 나눠내기 인원 선택 nested drawer(공개범위 「부분」의 GroupPickerDrawer와 동일
// DrawerNestedRoot 패턴). 칩을 누르면 즉시 적용하고 닫는다(단일 선택이라 버퍼/커밋
// 불필요). 금액 미입력이면 안내만 띄운다.
function SplitPickerDrawer({
  open,
  onOpenChange,
  baseAmount,
  currentValue,
  splitCount,
  splitTotal,
  onPick,
}: SplitPickerDrawerProps) {
  return (
    <DrawerNestedRoot open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-white/10 bg-background px-5 pb-8 pt-2">
        <DrawerHeader className="px-0 pb-3 pt-2 text-left">
          <DrawerTitle className="text-[20px] font-bold tracking-[-0.025em]">
            나눠서 냈어요
          </DrawerTitle>
          <DrawerDescription className="text-[13px] text-muted-foreground">
            총액을 인원수로 나눠 내 몫만 기록해요. 총액·인원은 친구에게 보이지
            않아요.
          </DrawerDescription>
        </DrawerHeader>

        {baseAmount > 0 ? (
          <div className="space-y-3">
            <SplitChips
              baseAmount={baseAmount}
              currentValue={currentValue}
              onPick={(next, people) => {
                onPick(next, people);
                onOpenChange(false);
              }}
            />
            <p className="text-[13px] leading-snug text-muted-foreground">
              {splitCount > 1 && splitTotal ? (
                <>
                  총 {formatNumber(splitTotal)}원을 {splitCount}명이 나눠서 · 내
                  몫{" "}
                  <span className="font-semibold text-foreground">
                    {formatNumber(currentValue)}원
                  </span>
                </>
              ) : (
                "인원을 고르면 금액칸이 내 몫으로 바뀌어요."
              )}
            </p>
          </div>
        ) : (
          <p className="rounded-2xl bg-muted px-4 py-6 text-center text-[13px] text-muted-foreground">
            먼저 금액을 입력한 뒤 인원을 나눠주세요.
          </p>
        )}
      </DrawerContent>
    </DrawerNestedRoot>
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
