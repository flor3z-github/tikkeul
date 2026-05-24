"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
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
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerNestedRoot,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import {
  CATEGORY_COLORS,
  CATEGORY_ICON_SLUGS,
  CategoryIcon,
} from "@/lib/utils/category-icon";
import type { TransactionFormCategory } from "@/components/transactions/transaction-form-dialog";

const CATEGORY_NAME_MAX_LENGTH = 10;

type Mode = "select" | "edit";
type View = "list" | "form";

type CategoryPickerDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Live category list owned by the parent form (seed + custom). */
  categories: TransactionFormCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Called after any create/update/delete so the parent can patch its local
   *  list and trigger `router.refresh()` to resync persisted order. */
  onMutated: (op: CategoryMutation) => void;
};

export type CategoryMutation =
  | { type: "create"; category: TransactionFormCategory }
  | { type: "update"; category: TransactionFormCategory }
  | { type: "delete"; id: string };

// Editability is authoritative: `getCategories` sets `isCustom` from the row's
// user_id (per-user customs are editable; NULL user_id seeds are locked). We
// never infer seed-vs-custom by name, since a user may create a custom named
// identically to a seed.
function isSeedCategory(category: TransactionFormCategory): boolean {
  return !category.isCustom;
}

export function CategoryPickerDrawer({
  open,
  onOpenChange,
  categories,
  selectedId,
  onSelect,
  onMutated,
}: CategoryPickerDrawerProps) {
  const [mode, setMode] = useState<Mode>("select");
  const [view, setView] = useState<View>("list");
  const [editing, setEditing] = useState<TransactionFormCategory | null>(null);
  const [lastOpenSeen, setLastOpenSeen] = useState(open);

  // Reset to the default select/list view every time the drawer reopens so a
  // prior edit session doesn't leak into the next open.
  if (open !== lastOpenSeen) {
    setLastOpenSeen(open);
    if (open) {
      setMode("select");
      setView("list");
      setEditing(null);
    }
  }

  function handleSelect(id: string) {
    onSelect(id);
    onOpenChange(false);
  }

  function openCreateForm() {
    setEditing(null);
    setView("form");
  }

  function openEditForm(category: TransactionFormCategory) {
    setEditing(category);
    setView("form");
  }

  function backToList() {
    setView("list");
    setEditing(null);
  }

  return (
    <DrawerNestedRoot open={open} onOpenChange={onOpenChange}>
      {/* Cap the sheet height so the long category list + form (6-col icon
          grid, 7-col color grid) can't grow unbounded. vaul's official
          scrollable-drawer pattern puts the height clamp on Drawer.Content
          itself; the inner overflow-y-auto scroller baked into DrawerContent
          then takes over. dvh (not vh) for iOS Safari, and the keyboard
          handler's inline maxHeight still wins over this class when the
          keyboard is open. */}
      <DrawerContent className="max-h-[85dvh] border-white/10 bg-background px-5 pb-8 pt-2">
        {view === "list" ? (
          <CategoryListView
            mode={mode}
            categories={categories}
            selectedId={selectedId}
            onToggleMode={() => setMode(mode === "select" ? "edit" : "select")}
            onSelect={handleSelect}
            onEdit={openEditForm}
            onCreate={openCreateForm}
          />
        ) : (
          <CategoryFormView
            editing={editing}
            onBack={backToList}
            onSelect={onSelect}
            onMutated={onMutated}
          />
        )}
      </DrawerContent>
    </DrawerNestedRoot>
  );
}

type CategoryListViewProps = {
  mode: Mode;
  categories: TransactionFormCategory[];
  selectedId: string | null;
  onToggleMode: () => void;
  onSelect: (id: string) => void;
  onEdit: (category: TransactionFormCategory) => void;
  onCreate: () => void;
};

function CategoryListView({
  mode,
  categories,
  selectedId,
  onToggleMode,
  onSelect,
  onEdit,
  onCreate,
}: CategoryListViewProps) {
  const isEdit = mode === "edit";

  return (
    <>
      <DrawerHeader className="flex flex-row items-center justify-between px-0 pb-3 pt-2 text-left">
        <div>
          <DrawerTitle className="text-[20px] font-bold tracking-[-0.025em]">
            카테고리
          </DrawerTitle>
          <DrawerDescription className="text-[13px] text-muted-foreground">
            {isEdit
              ? "내가 만든 카테고리를 수정·삭제할 수 있어요."
              : "이 소비의 카테고리를 선택하세요."}
          </DrawerDescription>
        </div>
        <button
          type="button"
          onClick={onToggleMode}
          className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {isEdit ? "완료" : "편집"}
        </button>
      </DrawerHeader>

      <ul className="space-y-1">
        {categories.map((category) => {
          const seed = isSeedCategory(category);
          const selected = category.id === selectedId;
          // Edit mode: seeds are locked (no tap target); customs open the
          // edit form. Select mode: every row selects + closes.
          const disabled = isEdit && seed;
          return (
            <li key={category.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (isEdit) {
                    if (!seed) onEdit(category);
                  } else {
                    onSelect(category.id);
                  }
                }}
                aria-pressed={!isEdit && selected}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors",
                  disabled
                    ? "cursor-default opacity-60"
                    : "hover:bg-muted active:scale-[0.99]",
                  !isEdit && selected ? "bg-secondary" : null,
                )}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"
                  style={
                    category.color ? { color: category.color } : undefined
                  }
                >
                  <CategoryIcon slug={category.icon} className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                  {category.name}
                </span>
                {isEdit ? (
                  seed ? (
                    <Lock
                      className="size-4 shrink-0 text-muted-foreground/70"
                      aria-label="기본 카테고리는 수정할 수 없어요"
                    />
                  ) : (
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )
                ) : selected ? (
                  <span className="size-2.5 shrink-0 rounded-full bg-primary" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onCreate}
        className="mt-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-primary transition-colors hover:bg-muted active:scale-[0.99]"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Plus className="size-4.5" aria-hidden />
        </span>
        <span className="text-[15px] font-semibold">새 카테고리</span>
      </button>
    </>
  );
}

type CategoryFormViewProps = {
  editing: TransactionFormCategory | null;
  onBack: () => void;
  onSelect: (id: string) => void;
  onMutated: CategoryPickerDrawerProps["onMutated"];
};

function CategoryFormView({
  editing,
  onBack,
  onSelect,
  onMutated,
}: CategoryFormViewProps) {
  const isEdit = editing !== null;
  const [name, setName] = useState(() => editing?.name ?? "");
  const [icon, setIcon] = useState<string>(
    () => editing?.icon ?? CATEGORY_ICON_SLUGS[0],
  );
  const [color, setColor] = useState<string>(
    () => editing?.color ?? CATEGORY_COLORS[0],
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

  const trimmedName = name.trim();
  const busy = pending || deletePending;
  const canSubmit = trimmedName.length > 0 && !busy;

  function handleSubmit() {
    if (!canSubmit) return;
    startTransition(async () => {
      if (isEdit && editing) {
        const result = await updateCategoryAction({
          id: editing.id,
          name: trimmedName,
          icon,
          color,
        });
        if (result.ok) {
          onMutated({ type: "update", category: result.category });
          toast.success("수정됐어요.");
          onBack();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createCategoryAction({
          name: trimmedName,
          icon,
          color,
        });
        if (result.ok) {
          onMutated({ type: "create", category: result.category });
          // Newly created category becomes the form's selection.
          onSelect(result.category.id);
          toast.success("추가됐어요.");
          onBack();
        } else {
          toast.error(result.error);
        }
      }
    });
  }

  function handleDelete() {
    if (!editing) return;
    startDeleteTransition(async () => {
      const result = await deleteCategoryAction(editing.id);
      if (result.ok) {
        onMutated({ type: "delete", id: editing.id });
        setConfirmDeleteOpen(false);
        toast.success("삭제됐어요.");
        onBack();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DrawerHeader className="flex flex-row items-center gap-2 px-0 pb-3 pt-2 text-left">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로"
          className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div>
          <DrawerTitle className="text-[20px] font-bold tracking-[-0.025em]">
            {isEdit ? "카테고리 수정" : "새 카테고리"}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            이름, 아이콘, 색상을 정해 카테고리를 만듭니다.
          </DrawerDescription>
        </div>
      </DrawerHeader>

      <div className="space-y-5">
        {/* Live preview */}
        <div className="flex items-center justify-center">
          <span
            className="flex size-16 items-center justify-center rounded-2xl bg-muted"
            style={{ color }}
          >
            <CategoryIcon slug={icon} className="size-7" />
          </span>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="category-name"
            className="block px-1 text-xs font-medium text-muted-foreground"
          >
            이름
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4">
            <input
              id="category-name"
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value.slice(0, CATEGORY_NAME_MAX_LENGTH))
              }
              maxLength={CATEGORY_NAME_MAX_LENGTH}
              placeholder="예: 반려동물"
              enterKeyHint="done"
              className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60"
            />
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">
              {name.length}/{CATEGORY_NAME_MAX_LENGTH}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <span className="block px-1 text-xs font-medium text-muted-foreground">
            아이콘
          </span>
          <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="아이콘">
            {CATEGORY_ICON_SLUGS.map((slug) => {
              const selected = slug === icon;
              return (
                <button
                  key={slug}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setIcon(slug)}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-xl border transition-all duration-150 ease-out active:scale-[0.95]",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  <CategoryIcon slug={slug} className="size-5" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <span className="block px-1 text-xs font-medium text-muted-foreground">
            색상
          </span>
          <div className="grid grid-cols-7 gap-2 px-1" role="radiogroup" aria-label="색상">
            {CATEGORY_COLORS.map((swatch) => {
              const selected = swatch === color;
              return (
                <button
                  key={swatch}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={swatch}
                  onClick={() => setColor(swatch)}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-[0.92]",
                    selected
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : null,
                  )}
                  style={{ backgroundColor: swatch }}
                />
              );
            })}
          </div>
        </div>

        {isEdit ? (
          <div className="grid grid-cols-4 gap-2">
            <Button
              type="button"
              onClick={handleSubmit}
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
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-12 w-full rounded-full text-[15px] font-semibold"
          >
            {pending ? "저장 중…" : "추가하기"}
          </Button>
        )}
      </div>

      {isEdit ? (
        <AlertDialog
          open={confirmDeleteOpen}
          onOpenChange={(next) => {
            if (!deletePending) setConfirmDeleteOpen(next);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>이 카테고리를 삭제할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                이 카테고리로 기록한 소비는 &lsquo;기타&rsquo;로 옮겨져요.
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
    </>
  );
}
