"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  CalendarIcon,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Layers,
  Pencil,
  SlidersHorizontal,
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
import { computeShare, SPLIT_MAX_PEOPLE } from "@/lib/utils/split";
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
  const [visibilityChoice, setVisibilityChoice] = useState<VisibilityChoice>(
    () => deriveInitialVisibilityChoice(initial),
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() =>
    deriveInitialSelectedGroupIds(initial, groups),
  );
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [splitPickerOpen, setSplitPickerOpen] = useState(false);
  const [installmentPickerOpen, setInstallmentPickerOpen] = useState(false);
  // 결제수단·공개범위를 한 묶음(「결제·공개」)으로 접는다. 기본 닫힘 — 상세 정보
  // 세로를 대폭 줄인다. 요약행에 현재값을 노출하므로 펼치지 않아도 저장값을 알 수 있다.
  const [detailExpanded, setDetailExpanded] = useState(false);
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
  // 할부 월 부담(무이자·floor — 우수리는 첫 회차). 금액 히어로 아래 힌트로 보여준다.
  const installmentPerMonth =
    installmentActive && amountValue >= installmentMonths
      ? Math.floor(amountValue / installmentMonths)
      : 0;
  // 「결제·공개」 요약행에 노출할 한 줄 요약. 신용+할부면 결제수단에 개월을 덧붙인다.
  const paymentSummary =
    paymentMethod === "credit" && installmentMonths >= 2
      ? `신용카드 · ${installmentMonths}개월`
      : PAYMENT_METHOD_LABELS[paymentMethod];
  const visibilitySummary =
    visibilityChoice === "all"
      ? "전체 공개"
      : visibilityChoice === "private"
        ? "비공개"
        : "부분 공개";
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
    // 분할 상태에서 빠른 금액을 더하면 "총액/N=내 몫" 관계가 깨진다 — 분할 해제(더해진
    // 값이 곧 새 금액). 수동 입력(handleAmountChange)과 동일 규칙. StrictMode 이중호출
    // 방지 위해 updater 밖 평범한 set으로(1/null은 idempotent).
    if (splitCount > 1) {
      setSplitCount(1);
      setSplitTotal(null);
    }
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
    // X로 지우면 분할도 해제한다 — 안 그러면 금액칸은 비었는데 "총 X ÷ N명" 메타/캡션과
    // select N이 그대로 남아 stale 상태가 된다(재현: 3명 분할 후 X). 무조건 초기화.
    setSplitCount(1);
    setSplitTotal(null);
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
        {/* 나눠내기 진입 — 아이콘만, 좌상단(되돌리기/삭제와 대칭). 아래 줄을 아껴
            히어로를 짧게 유지한다. 분할하면 히어로 숫자가 곧 내 몫이라 아이콘엔
            인원수 배지만 얹는다. 할부(월≥2)와 상호배타 — 할부 켜지면 숨긴다.
            stopPropagation: 카드 전체가 focusAmountInput이라 탭이 안 새게. 기준
            총액 0원이면 비활성(dim) + pointer-events-none으로 탭을 카드에 흘려 포커스. */}
        {!installmentActive ? (
          <button
            type="button"
            disabled={splitBaseAmount <= 0}
            onClick={(event) => {
              event.stopPropagation();
              setSplitPickerOpen(true);
            }}
            aria-label={splitCount > 1 ? `나눠내기 ${splitCount}명` : "나눠내기"}
            aria-pressed={splitCount > 1}
            className={cn(
              "absolute left-3 top-3 flex size-7 items-center justify-center rounded-full transition-all duration-150 ease-out active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40",
              splitCount > 1
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card text-muted-foreground hover:bg-background",
            )}
          >
            <Users className="size-3.5" aria-hidden />
            {splitCount > 1 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-background px-1 text-[10px] font-bold tabular-nums text-primary shadow-sm">
                {splitCount}
              </span>
            ) : null}
          </button>
        ) : null}
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
        <div className="space-y-1">
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
          {/* 할부 월 부담 힌트. 히어로 금액은 원금 총액이므로, 할부면 월 얼마씩
              나가는지 작게 덧붙인다(무이자·floor, 우수리는 첫 회차). */}
          {installmentPerMonth > 0 ? (
            <p className="text-center text-[12px] font-medium tabular-nums text-muted-foreground">
              월 약 {formatNumber(installmentPerMonth)}원 × {installmentMonths}개월
            </p>
          ) : null}
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
        {/* 메모 (항상 표시 — 자주 쓰는 입력이라 묶음 밖에 둔다). */}
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

        {/* Native date input (matches the savings form). 항상 표시. `appearance-none`
            lets iOS Safari honor the row width (native controls otherwise keep an
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

        {/* 결제수단·공개범위 묶음: 요약행(현재값 노출) + 펼침. 기본 닫힘 → 세로 대폭
            감소. 펼치면 결제수단 토글(+신용 시 할부 버튼)과 공개범위 토글(+부분 시 그룹
            버튼)이 나온다. 둘 다 자주 안 바꾸는 설정이라 접어 두고, 메모·날짜는 자주
            써서 묶음 밖 항상 표시로 남긴다. `›`는 펼치면 아래로 회전. */}
        <div>
          <button
            type="button"
            onClick={() => setDetailExpanded((v) => !v)}
            aria-expanded={detailExpanded}
            className="flex h-12 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-muted/60"
          >
            <SlidersHorizontal
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              결제·공개
            </span>
            {/* 결제 데이터(신용카드·N개월)와 공개범위 데이터는 서로 다른 축이라
                구분한다: 결제는 진한 색, 얇은 세로 구분선, 공개는 연한 색. 그룹 안
                「·」와 그룹 사이 구분선이 2단으로 나뉘어 한 덩어리로 안 읽힌다. */}
            <span className="ml-auto flex min-w-0 items-center gap-2 text-[13px]">
              <span className="min-w-0 truncate font-medium">
                {paymentSummary}
              </span>
              <span className="h-3 w-px shrink-0 bg-border" aria-hidden />
              <span className="shrink-0 font-medium text-muted-foreground">
                {visibilitySummary}
              </span>
            </span>
            <ChevronRight
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                detailExpanded && "rotate-90",
              )}
              aria-hidden
            />
          </button>
          {detailExpanded ? (
            <div className="divide-y divide-border border-t border-border">
              <PaymentMethodSelector
                value={paymentMethod}
                installmentMonths={installmentMonths}
                onChange={(next) => {
                  if (next !== "credit") {
                    setPaymentMethod(next);
                    // 체크는 할부 불가 — 일시불로 리셋.
                    setInstallmentMonths(1);
                  } else {
                    setPaymentMethod("credit");
                    // 신용 탭(전환이든 재탭이든) → 할부 drawer를 연다. 별도 할부 행을
                    // 없애고 신용 chip이 곧 할부 진입점 — 재탭으로 개월을 바꾼다.
                    // 분할 중·편집 모드면 할부가 없으므로 제외(마지막 결제수단이
                    // 기억되므로 신용 상시 유저는 재탭이 없어 성가시지 않다).
                    if (mode === "create" && splitCount === 1) {
                      setInstallmentPickerOpen(true);
                    }
                  }
                }}
              />
              <VisibilitySelector
                value={visibilityChoice}
                onChange={handleSelectVisibility}
                selectedGroupCount={selectedGroupIds.length}
                groupsAvailable={groupsAvailable}
                onOpenGroupPicker={() => setGroupPickerOpen(true)}
              />
            </div>
          ) : null}
        </div>
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
        value={splitCount}
        onPick={(people) =>
          handlePickSplit(computeShare(splitBaseAmount, people), people)
        }
      />

      <InstallmentPickerDrawer
        open={installmentPickerOpen}
        onOpenChange={setInstallmentPickerOpen}
        principal={amountValue}
        value={installmentMonths}
        onPick={setInstallmentMonths}
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
  /** 신용 선택 + 할부(개월≥2)면 신용 chip에 「· N개월」을 덧붙인다. */
  installmentMonths: number;
};

// 토글 표시 순서(체크→신용). cold-start 기본값이 체크라 좌측에 둔다. 집계용
// PAYMENT_METHODS(credit→debit)와 분리 — /stats 버킷 순서는 건드리지 않는다.
const PAYMENT_METHOD_TOGGLE_ORDER: readonly PaymentMethod[] = ["debit", "credit"];

// 결제수단 2-세그먼트 토글. 별도 할부 행을 없앴다 — 신용 chip 자체가 할부 진입점이라
// (부모 onChange가 신용 탭 시 InstallmentPickerDrawer를 연다) 세로 1줄을 아낀다.
// 할부가 걸리면 신용 chip이 「신용카드 · N개월」로 바뀌어 현재 개월을 보여주고,
// 재탭하면 개월을 다시 고른다.
function PaymentMethodSelector({
  value,
  onChange,
  installmentMonths,
}: PaymentMethodSelectorProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
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
        {PAYMENT_METHOD_TOGGLE_ORDER.map((method) => {
          const selected = method === value;
          const showMonths =
            method === "credit" && selected && installmentMonths >= 2;
          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(method)}
              className={cn(
                "h-8 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium tabular-nums transition-all duration-150 ease-out",
                "active:scale-[0.98]",
                selected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background",
              )}
            >
              {PAYMENT_METHOD_LABELS[method]}
              {showMonths ? ` · ${installmentMonths}개월` : ""}
            </button>
          );
        })}
      </div>
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

// 나눠내기 인원 picker. drawer 안 native select 하나로 고른다(칩 그리드가 도움이
// 안 된다는 피드백 → select). 옵션은 1(안 나눔) + 2~SPLIT_MAX_PEOPLE(= DB CHECK 2~10
// 단일 소스). 각 옵션 라벨에 내 몫(computeShare)을 함께 보여주고, 선택 즉시 적용 + 닫기.
const SPLIT_PEOPLE_OPTIONS: readonly number[] = Array.from(
  { length: SPLIT_MAX_PEOPLE },
  (_, i) => i + 1,
);

type SplitPickerDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 나눌 기준 총액 — 분할 중이면 저장된 총액(splitTotal), 아니면 현재 입력값. */
  baseAmount: number;
  /** 현재 인원(splitCount, 1 = 안 나눔) — select 초기값. */
  value: number;
  onPick: (people: number) => void;
};

function SplitPickerDrawer({
  open,
  onOpenChange,
  baseAmount,
  value,
  onPick,
}: SplitPickerDrawerProps) {
  return (
    <DrawerNestedRoot open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-white/10 bg-background px-5 pb-8 pt-2">
        <DrawerHeader className="px-0 pb-3 pt-2 text-left">
          <DrawerTitle className="text-[20px] font-bold tracking-[-0.025em]">
            나눠내기
          </DrawerTitle>
          <DrawerDescription className="text-[13px] text-muted-foreground">
            결제한 총액 기준으로 내 몫만 기록해요.
          </DrawerDescription>
        </DrawerHeader>
        {/* native select(drawer 안 base-ui Select 금지 규칙 — native는 허용).
            appearance-none으로 iOS 폭 이슈 회피, caret은 ChevronDown을 얹는다. */}
        <div className="relative">
          <select
            aria-label="나눈 인원"
            value={value >= 2 ? value : 1}
            onChange={(event) => {
              onPick(Number(event.target.value));
              onOpenChange(false);
            }}
            className="h-12 w-full appearance-none rounded-2xl border border-border bg-card px-4 pr-10 text-[15px] font-medium outline-none [-webkit-appearance:none]"
          >
            {SPLIT_PEOPLE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 1
                  ? "안 나눔"
                  : `${n}명 · 내 몫 ${formatNumber(computeShare(baseAmount, n))}원`}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>
      </DrawerContent>
    </DrawerNestedRoot>
  );
}

type InstallmentPickerDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 원금 총액 — 칩별 월 부담 서브라벨 계산용. */
  principal: number;
  value: number;
  onPick: (months: number) => void;
};

// 할부 개월 picker. drawer 안 native select 하나로 고른다(칩 그리드 → select 피드백).
// 각 옵션 라벨에 월 부담(floor, 우수리는 첫 회차 — lib/utils/installment.ts와 일치)을
// 함께 보여주고, 선택 즉시 적용 + 닫기.
function InstallmentPickerDrawer({
  open,
  onOpenChange,
  principal,
  value,
  onPick,
}: InstallmentPickerDrawerProps) {
  return (
    <DrawerNestedRoot open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-white/10 bg-background px-5 pb-8 pt-2">
        <DrawerHeader className="px-0 pb-3 pt-2 text-left">
          <DrawerTitle className="text-[20px] font-bold tracking-[-0.025em]">
            할부
          </DrawerTitle>
          <DrawerDescription className="text-[13px] text-muted-foreground">
            무이자 기준이에요. 우수리는 첫 회차에 포함돼요.
          </DrawerDescription>
        </DrawerHeader>
        {/* native select(drawer 안 base-ui Select 금지 규칙 — native는 허용).
            appearance-none으로 iOS 폭 이슈 회피, caret은 ChevronDown을 얹는다. */}
        <div className="relative">
          <select
            aria-label="할부 개월"
            value={value}
            onChange={(event) => {
              onPick(Number(event.target.value));
              onOpenChange(false);
            }}
            className="h-12 w-full appearance-none rounded-2xl border border-border bg-card px-4 pr-10 text-[15px] font-medium outline-none [-webkit-appearance:none]"
          >
            {INSTALLMENT_OPTIONS.map((m) => {
              const perMonth =
                m >= 2 && principal >= m ? Math.floor(principal / m) : 0;
              return (
                <option key={m} value={m}>
                  {m === 1
                    ? "일시불"
                    : perMonth > 0
                      ? `${m}개월 · 월 ${formatNumber(perMonth)}원`
                      : `${m}개월`}
                </option>
              );
            })}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>
      </DrawerContent>
    </DrawerNestedRoot>
  );
}
