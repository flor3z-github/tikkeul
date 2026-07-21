"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarSync, ChevronDown, ChevronRight } from "lucide-react";

import { saveCycleAction } from "@/app/settings/actions";
import { SaveIndicator, useAutoSave } from "@/components/settings/auto-save";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCycleLabelLong } from "@/lib/utils/calendar";
import { cn } from "@/lib/utils";
import {
  getCurrentCycleB,
  groupForPayday,
  paydayGroupToDb,
  type PaydayGroup,
  type PayrollRule,
} from "@/lib/utils/payday-cycle";

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

const MID_DAY_OPTIONS = Array.from({ length: 27 }, (_, i) => i + 2); // 2..28

function payrollRuleLabel(value: string | null): string {
  return PAYROLL_RULE_OPTIONS.find((opt) => opt.value === value)?.label ?? "";
}

type PaydayCycleDrawerProps = {
  initialPayday: number;
  initialPayrollRule: PayrollRule;
  holidays: string[];
};

export function PaydayCycleDrawer({
  initialPayday,
  initialPayrollRule,
  holidays,
}: PaydayCycleDrawerProps) {
  const [group, setGroup] = useState<PaydayGroup>(groupForPayday(initialPayday));
  const [midDay, setMidDay] = useState<number>(
    initialPayday >= 2 && initialPayday <= 28 ? initialPayday : 25,
  );
  const [payrollRule, setPayrollRule] =
    useState<PayrollRule>(initialPayrollRule);
  // 급여 규정은 기본 접힘 — 주말·공휴일 보정이 필요한 사람만 펼친다(점진적 노출).
  const [ruleOpen, setRuleOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // "저장" 탭에서만 commit. backdrop/스와이프/ESC 닫힘과 구분하는 의도 플래그.
  const committingRef = useRef(false);

  // Last-saved baselines — auto-save fires only when the live value diverges
  // from these, and they advance on each successful save.
  const [savedPayday, setSavedPayday] = useState(initialPayday);
  const [savedRule, setSavedRule] = useState<PayrollRule>(initialPayrollRule);

  const cycleSave = useAutoSave();

  // Rebuild the holiday Set once (it crosses the RSC boundary as string[]).
  const holidaySet = useMemo(() => new Set(holidays), [holidays]);
  const paydayDb = useMemo(
    () => paydayGroupToDb(group, midDay),
    [group, midDay],
  );
  const cyclePreview = useMemo(() => {
    const range = getCurrentCycleB(paydayDb, payrollRule, holidaySet);
    return formatCycleLabelLong(range.start, range.end);
  }, [paydayDb, payrollRule, holidaySet]);

  const dayLabel =
    group === "first" ? "1일" : group === "last" ? "말일" : `${midDay}일`;
  const cycleSummary = `${dayLabel} · ${PAYROLL_RULE_SHORT[payrollRule]}`;

  // The cycle commits ONLY when "저장" is tapped. A backdrop tap / swipe-down /
  // ESC dismiss DISCARDS the unsaved selection (reverts to the last-saved
  // baseline); a failed save also reverts (revertCycle as onError).
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
      {/* 돈 들어오는 날 row — /income의 "월 수입" row와 형제로 읽히는 Card row.
          긴 값(예: "25일 · 이전 영업일")은 우측 정렬 대신 서브라인으로 내려
          좁은 화면에서 overflow하지 않게 한다. 저장 중엔 chevron 앞에
          SaveIndicator를 띄운다. */}
      <Card className="mt-3 rounded-3xl border-black/[0.08] bg-card py-0 shadow-none dark:border-white/[0.10]">
        <CardContent className="p-2">
          <button
            type="button"
            onClick={() => {
              committingRef.current = false; // 새 편집 세션 — 가드 리셋
              setPickerOpen(true);
            }}
            aria-haspopup="dialog"
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-muted active:bg-muted"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium leading-tight">
                돈 들어오는 날
              </p>
              <p className="mt-0.5 truncate text-[12px] leading-tight text-muted-foreground">
                {cycleSummary}
              </p>
            </div>
            <SaveIndicator status={cycleSave.status} />
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>
        </CardContent>
      </Card>

      {/* 돈 들어오는 날 picker — 선택은 즉시 부모 state(group/midDay/payrollRule)에
          반영되지만 draft일 뿐 — "저장" 탭에서만 commit, backdrop/스와이프/ESC
          닫힘은 변경을 폐기한다. (settings-form.tsx의 동일 Drawer 블록과 이식
          동형 — 두 화면 모두 payday 설정을 노출하는 과도기 중복.) */}
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
                    {/* Native <select> (mirrors components/fixed-expenses/
                        payment-day-select.tsx): hands the picker to the OS wheel
                        (iOS) / dropdown (Android) — zero JS popup, so no base-ui
                        press-drag-release latency and no vaul modal-portal
                        conflict. Safe here even with /income's bottom nav: the
                        vaul drawer's overlay covers it while open. */}
                    <div className="relative w-28 shrink-0">
                      <select
                        id="payday-day"
                        value={String(midDay)}
                        onChange={(e) => setMidDay(Number(e.target.value))}
                        disabled={group !== "mid"}
                        className="h-10 w-full appearance-none rounded-xl border border-input bg-transparent pl-3 pr-9 text-[14px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {MID_DAY_OPTIONS.map((day) => (
                          <option key={day} value={day}>
                            {day}일
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        aria-hidden
                        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      />
                    </div>
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
