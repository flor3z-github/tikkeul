"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarSync, Check, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import {
  saveCycleAction,
  saveIncomeAction,
  saveNicknameAction,
} from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCycleLabelLong } from "@/lib/utils/calendar";
import { cn } from "@/lib/utils";
import { getCurrentCycleB, type PayrollRule } from "@/lib/utils/payday-cycle";
import {
  formatAmountInput,
  formatNumber,
  parseAmountInput,
} from "@/lib/utils/money";
import { NICKNAME_MAX_LENGTH } from "@/lib/utils/nickname";

type SettingsFormProps = {
  initialIncome: number;
  initialNickname: string;
  initialPayday: number;
  initialPayrollRule: PayrollRule;
  holidays: string[];
};

type ActionResult = { ok: true } | { ok: false; error: string };

const PAYROLL_RULE_OPTIONS: {
  value: PayrollRule;
  label: string;
  example?: string;
}[] = [
  { value: "prev", label: "앞당겨 들어와요", example: "예: 토요일이면 금요일" },
  { value: "same", label: "날짜 그대로" },
  { value: "next", label: "미뤄서 들어와요", example: "예: 토요일이면 월요일" },
];

// Compact rule label for the collapsed 돈 들어오는 날 row summary (the verbose
// PAYROLL_RULE_OPTIONS labels are for the expanded picker).
const PAYROLL_RULE_SHORT: Record<PayrollRule, string> = {
  prev: "이전 영업일",
  same: "날짜 그대로",
  next: "다음 영업일",
};

// 돈 들어오는 날 picker is grouped into 3 buckets that mirror the 3 distinct
// label/cycle behaviors: 1일 (월초, 「N월」), 특정일 2..28 (range label), 말일
// (월말, 「N+1월」). They map back to user_settings.payday: first->1, last->0,
// mid->the chosen day. payday 29..31 is never offered (true 말일 = 'last').
type PaydayGroup = "first" | "mid" | "last";
const MID_DAY_OPTIONS = Array.from({ length: 27 }, (_, i) => i + 2); // 2..28

const SECTION_HEADING = "text-[15px] font-semibold tracking-[-0.01em]";

function payrollRuleLabel(value: string | null): string {
  return PAYROLL_RULE_OPTIONS.find((opt) => opt.value === value)?.label ?? "";
}

// Map a stored payday (0=말일, 1, 2..28) back to the picker's group/midDay so
// a failed cycle save can revert the UI to the last-saved selection.
function groupForPayday(payday: number): PaydayGroup {
  return payday === 0 ? "last" : payday >= 2 ? "mid" : "first";
}

type SaveStatus = "idle" | "saving" | "saved";

// Per-field auto-save: drives a transient "저장 중…/저장됨 ✓" indicator and
// surfaces failures as a toast. The caller decides what to do with the field
// value on failure (text fields keep it, the cycle row reverts) via the
// returned boolean / onError.
function useAutoSave() {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const save = useCallback(
    async (
      action: () => Promise<ActionResult>,
      onError?: () => void,
    ): Promise<boolean> => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      setStatus("saving");
      let res: ActionResult;
      try {
        res = await action();
      } catch {
        res = { ok: false, error: "저장에 실패했어요." };
      }
      if (res.ok) {
        setStatus("saved");
        timer.current = setTimeout(() => setStatus("idle"), 1500);
        return true;
      }
      setStatus("idle");
      toast.error(res.error);
      onError?.();
      return false;
    },
    [],
  );

  return { status, save };
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span
      aria-live="polite"
      className="flex items-center gap-1 text-xs text-muted-foreground"
    >
      {status === "saving" ? (
        "저장 중…"
      ) : (
        <>
          <Check className="size-3.5 text-emerald-600" aria-hidden />
          저장됨
        </>
      )}
    </span>
  );
}

export function SettingsForm({
  initialIncome,
  initialNickname,
  initialPayday,
  initialPayrollRule,
  holidays,
}: SettingsFormProps) {
  const [income, setIncome] = useState(
    initialIncome ? formatNumber(initialIncome) : "",
  );
  const [nickname, setNickname] = useState(initialNickname);
  const [group, setGroup] = useState<PaydayGroup>(
    groupForPayday(initialPayday),
  );
  const [midDay, setMidDay] = useState<number>(
    initialPayday >= 2 && initialPayday <= 28 ? initialPayday : 25,
  );
  const [payrollRule, setPayrollRule] =
    useState<PayrollRule>(initialPayrollRule);
  // 급여 규정은 기본 접힘 — 주말·공휴일 보정이 필요한 사람만 펼친다(점진적 노출).
  const [ruleOpen, setRuleOpen] = useState(false);
  // 돈 들어오는 날 picker는 1 depth 뒤(drawer)로 보낸다 — 랜딩에서 큰 radio
  // 카드를 걷어내 설정 화면을 짧게 유지한다.
  const [pickerOpen, setPickerOpen] = useState(false);
  // "저장" 탭에서만 commit. backdrop/스와이프/ESC 닫힘과 구분하는 의도 플래그.
  // (trigger·확인 둘 다 onOpenChange를 우회해 setPickerOpen을 직접 부르므로,
  // 닫힘이 저장 의도인지 vaul만으로는 알 수 없다.)
  const committingRef = useRef(false);

  // Last-saved baselines — auto-save fires only when the live value diverges
  // from these, and they advance on each successful save. (Seeded from props
  // at mount only; no prop→state sync effect, which would clobber editing when
  // a save's revalidatePath refreshes this RSC.)
  const [savedNickname, setSavedNickname] = useState(initialNickname.trim());
  const [savedIncome, setSavedIncome] = useState(initialIncome);
  const [savedPayday, setSavedPayday] = useState(initialPayday);
  const [savedRule, setSavedRule] = useState<PayrollRule>(initialPayrollRule);

  const nicknameSave = useAutoSave();
  const incomeSave = useAutoSave();
  const cycleSave = useAutoSave();

  // Rebuild the holiday Set once (it crosses the RSC boundary as string[]).
  const holidaySet = useMemo(() => new Set(holidays), [holidays]);
  const paydayDb = useMemo(
    () => (group === "first" ? 1 : group === "last" ? 0 : midDay),
    [group, midDay],
  );
  const cyclePreview = useMemo(() => {
    const range = getCurrentCycleB(paydayDb, payrollRule, holidaySet);
    return formatCycleLabelLong(range.start, range.end);
  }, [paydayDb, payrollRule, holidaySet]);

  const dayLabel =
    group === "first" ? "1일" : group === "last" ? "말일" : `${midDay}일`;
  const cycleSummary = `${dayLabel} · ${PAYROLL_RULE_SHORT[payrollRule]}`;

  // Text fields auto-save on blur. On failure the typed value is KEPT (the
  // standard auto-save behavior) so the user can fix-and-reblur rather than
  // being forced to retype.
  async function handleNicknameBlur() {
    const trimmed = nickname.trim();
    if (trimmed === savedNickname) return;
    const ok = await nicknameSave.save(() => saveNicknameAction(trimmed));
    if (ok) setSavedNickname(trimmed);
  }

  async function handleIncomeBlur() {
    const parsed = parseAmountInput(income);
    if (parsed === savedIncome) return;
    const ok = await incomeSave.save(() => saveIncomeAction(parsed));
    if (ok) setSavedIncome(parsed);
  }

  // The cycle commits ONLY when "저장" is tapped. A backdrop tap / swipe-down /
  // ESC dismiss DISCARDS the unsaved selection (reverts the live values to the
  // last-saved baseline) — the collapsed row is a value summary, so it must
  // never display an abandoned edit. A failed save also REVERTS (revertCycle as
  // the onError callback).
  function revertCycle() {
    setGroup(groupForPayday(savedPayday));
    if (savedPayday >= 2 && savedPayday <= 28) setMidDay(savedPayday);
    setPayrollRule(savedRule);
  }

  async function commitCycle() {
    if (paydayDb === savedPayday && payrollRule === savedRule) return;
    const nextPayday = paydayDb;
    const nextRule = payrollRule;
    const ok = await cycleSave.save(
      () => saveCycleAction(nextPayday, nextRule),
      revertCycle,
    );
    if (ok) {
      setSavedPayday(nextPayday);
      setSavedRule(nextRule);
    }
  }

  // "저장" 탭 — 의도 플래그를 세우고 commit 시작 후 닫는다. trigger와 동일하게
  // onOpenChange를 우회하므로, vaul이 close에서 onOpenChange를 재발화하더라도
  // 아래 가드가 그 1회를 삼킨다.
  function confirmCycle() {
    committingRef.current = true;
    void commitCycle();
    setPickerOpen(false);
  }

  function handlePickerOpenChange(open: boolean) {
    if (open) {
      setPickerOpen(true);
      return;
    }
    setPickerOpen(false);
    if (committingRef.current) {
      committingRef.current = false; // confirmCycle이 이미 저장 시작 — 재발화 무시
      return;
    }
    revertCycle(); // backdrop/스와이프/ESC → 미저장 편집 폐기
  }

  return (
    <>
      <div>
        <section className="space-y-4">
          <h2 className={SECTION_HEADING}>내 정보</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="nickname">닉네임</Label>
              <SaveIndicator status={nicknameSave.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              친구가 보는 이름이에요.
            </p>
            <Input
              id="nickname"
              name="nickname"
              autoComplete="off"
              maxLength={NICKNAME_MAX_LENGTH}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              onBlur={handleNicknameBlur}
              placeholder="닉네임을 입력해주세요"
              className="h-12 rounded-2xl bg-card text-[16px]"
            />
          </div>
        </section>

        <section className="mt-10 space-y-4 border-t border-border pt-6">
          <h2 className={SECTION_HEADING}>예산</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="monthly_income">월 수입</Label>
              <SaveIndicator status={incomeSave.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              매달 들어오는 실수령 금액을 입력해주세요.
            </p>
            <div className="relative">
              <Input
                id="monthly_income"
                name="monthly_income"
                inputMode="numeric"
                autoComplete="off"
                value={income}
                onChange={(event) =>
                  setIncome(formatAmountInput(event.target.value))
                }
                onBlur={handleIncomeBlur}
                placeholder="예: 3,000,000"
                className="h-12 rounded-2xl bg-card pr-10 text-[16px]"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground"
              >
                원
              </span>
            </div>
          </div>

          {/* 돈 들어오는 날 — 라벨 위 / 값 박스 아래. 닉네임·월 수입과 같은
              label-above 그리드라 헤더 없는 박스가 떠 보이지 않는다. 박스는
              값+chevron만 띄우는 select 트리거 형태고, 탭하면 picker drawer를
              연다(라벨 클릭도 button을 트리거). 저장 인디케이터는 라벨 우측
              transient — 다른 필드와 동일, 빈 자리 예약 없음. */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="payday-trigger">돈 들어오는 날</Label>
              <SaveIndicator status={cycleSave.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              월급·용돈이 들어오는 날에 맞춰 집계해요.
            </p>
            <button
              id="payday-trigger"
              type="button"
              onClick={() => {
                committingRef.current = false; // 새 편집 세션 시작 — 가드 리셋
                setPickerOpen(true);
              }}
              aria-haspopup="dialog"
              className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl bg-card px-4 text-left text-[14px] transition-colors hover:bg-muted/60 active:bg-muted"
            >
              <span className="font-medium">{cycleSummary}</span>
              <ChevronRight
                className="size-4 text-muted-foreground"
                aria-hidden
              />
            </button>
          </div>
        </section>
      </div>

      {/* 돈 들어오는 날 picker — 랜딩에서 1 depth 뒤로 보낸 본문. 선택은 즉시
          부모 state(group/midDay/payrollRule)에 반영되지만 draft일 뿐 —
          "저장" 탭에서만 commit, backdrop/스와이프/ESC 닫힘은 변경을 폐기한다. */}
      <Drawer open={pickerOpen} onOpenChange={handlePickerOpenChange}>
        <DrawerContent className="border-white/10 bg-background px-5 pb-8 pt-4">
          <DrawerHeader className="px-0 pb-3 pt-2 text-left">
            <DrawerTitle className="text-[20px] font-bold tracking-[-0.025em]">
              돈 들어오는 날
            </DrawerTitle>
            <DrawerDescription className="text-[13px] text-muted-foreground">
              월급·용돈처럼 돈이 들어오는 날에 맞춰 소비를 집계해요.
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <RadioGroup
              value={group}
              onValueChange={(value) => setGroup(value as PaydayGroup)}
              className="gap-0"
            >
              <div
                role="presentation"
                onClick={() => setGroup("first")}
                className="cursor-pointer p-4"
              >
                <span className="flex items-center gap-3">
                  <RadioGroupItem id="payday-first" value="first" />
                  <span className="text-sm font-semibold">1일</span>
                </span>
                <span className="mt-1 block pl-7 text-xs text-muted-foreground">
                  매월 1일에 들어와요. 달력 기준으로 집계해요.
                </span>
              </div>

              <div
                role="presentation"
                onClick={() => setGroup("mid")}
                className="cursor-pointer border-t border-border p-4"
              >
                <span className="flex items-center gap-3">
                  <RadioGroupItem id="payday-mid" value="mid" />
                  <span className="text-sm font-semibold">특정일</span>
                </span>
                <span className="mt-1 block pl-7 text-xs text-muted-foreground">
                  급여일처럼 매월 정해진 날에 들어와요.
                </span>
              </div>

              {/* 며칠 picker — nested right under 특정일, revealed only for 'mid' */}
              {/* compositor-only reveal — same pattern as the payroll panel: grid
                  row snaps, inner content slides+fades via transform/opacity. */}
              <div
                className={cn(
                  "grid",
                  group === "mid"
                    ? "border-t border-border"
                    : "border-t border-transparent",
                )}
                style={{ gridTemplateRows: group === "mid" ? "1fr" : "0fr" }}
                aria-hidden={group !== "mid"}
              >
                <div className="overflow-hidden">
                  <div
                    className={cn(
                      "flex items-center justify-between gap-3 bg-muted/60 py-3 pl-11 pr-4 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
                      group === "mid"
                        ? "translate-y-0 opacity-100"
                        : "-translate-y-1 opacity-0",
                    )}
                  >
                    <Label htmlFor="payday-day" className="text-sm">
                      며칠에 들어오나요
                    </Label>
                    <Select
                      value={String(midDay)}
                      onValueChange={(value) => setMidDay(Number(value ?? "25"))}
                      disabled={group !== "mid"}
                    >
                      <SelectTrigger
                        id="payday-day"
                        className="h-10 w-28 shrink-0 rounded-xl text-[14px]"
                        tabIndex={group === "mid" ? 0 : -1}
                      >
                        <SelectValue>
                          {(value) => (value ? `${value}일` : "")}
                        </SelectValue>
                      </SelectTrigger>
                      {/* alignItemWithTrigger={false}: open as a plain dropdown
                          BELOW the trigger, not an overlay under the finger. The
                          overlay mode put the selected item under the touch point,
                          turning the open-tap into base-ui's press-drag-release
                          gesture which is gated by a 200–400ms mouseup grace — felt
                          as selection lag. A dropdown gets discrete taps (instant
                          path), no grace. */}
                      <SelectContent alignItemWithTrigger={false}>
                        {MID_DAY_OPTIONS.map((day) => (
                          <SelectItem key={day} value={String(day)}>
                            {day}일
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div
                role="presentation"
                onClick={() => setGroup("last")}
                className="cursor-pointer border-t border-border p-4"
              >
                <span className="flex items-center gap-3">
                  <RadioGroupItem id="payday-last" value="last" />
                  <span className="text-sm font-semibold">말일</span>
                </span>
                <span className="mt-1 block pl-7 text-xs text-muted-foreground">
                  매월 마지막 날에 들어와요.
                </span>
              </div>
            </RadioGroup>

            {/* ── 하위 계층: 면을 낮춘(bg-muted) 종속 zone — 보정 + 프리뷰 ── */}
            <div className="border-t border-border bg-muted/60">
              {/* 주말·공휴일 보정 — 기본 접힘, 현재값 노출 + 펼치면 RadioGroup */}
              <button
                type="button"
                onClick={() => setRuleOpen((open) => !open)}
                aria-expanded={ruleOpen}
                aria-controls="payroll-rule-panel"
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <CalendarSync
                    aria-hidden
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                  <span className="text-sm font-medium text-muted-foreground">
                    주말·공휴일 겹칠 때
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                  {payrollRuleLabel(payrollRule)}
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-4 transition-transform duration-200 motion-reduce:transition-none",
                      ruleOpen && "rotate-180",
                    )}
                  />
                </span>
              </button>

              {/* Compositor-only reveal (60fps on iOS Safari). The grid row snaps
                  open/closed instantly — one reflow, the content below jumps to its
                  final spot — and the panel content slides+fades in via
                  transform/opacity (GPU-composited, layer size held constant).
                  Animating grid-template-rows here re-uploaded the layer texture
                  every frame and dropped the open to ~30fps. See memory
                  ios-reveal-animations-composite-bound. */}
              <div
                id="payroll-rule-panel"
                className="grid"
                style={{ gridTemplateRows: ruleOpen ? "1fr" : "0fr" }}
                aria-hidden={!ruleOpen}
              >
                <div className="overflow-hidden border-t border-border/50">
                  <RadioGroup
                    value={payrollRule}
                    onValueChange={(value) =>
                      setPayrollRule((value ?? "prev") as PayrollRule)
                    }
                    className={cn(
                      "gap-0 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
                      ruleOpen
                        ? "translate-y-0 opacity-100"
                        : "-translate-y-1 opacity-0",
                    )}
                  >
                    {PAYROLL_RULE_OPTIONS.map((opt, index) => (
                      <div
                        key={opt.value}
                        role="presentation"
                        onClick={() => setPayrollRule(opt.value)}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 py-3 pl-11 pr-4",
                          index > 0 && "border-t border-border/50",
                        )}
                      >
                        <RadioGroupItem
                          id={`rule-${opt.value}`}
                          value={opt.value}
                          className="mt-0.5"
                          tabIndex={ruleOpen ? 0 : -1}
                        />
                        <span className="space-y-0.5">
                          <span className="block text-sm font-medium">
                            {opt.label}
                          </span>
                          {opt.example ? (
                            <span className="block text-xs text-muted-foreground">
                              {opt.example}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>

              {/* cycle preview — tier-3, 가장 흐리게 */}
              <div className="border-t border-border/50 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  이번 주기: {cyclePreview}
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={confirmCycle}
            className="mt-4 h-12 w-full rounded-full text-[15px] font-semibold"
          >
            저장
          </Button>
        </DrawerContent>
      </Drawer>
    </>
  );
}
