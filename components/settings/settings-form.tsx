"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { CalendarSync, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { saveSettingsAction } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
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
import { formatAmountInput, formatNumber } from "@/lib/utils/money";
import { NICKNAME_MAX_LENGTH } from "@/lib/utils/nickname";

type SettingsFormProps = {
  initialIncome: number;
  initialNickname: string;
  initialPayday: number;
  initialPayrollRule: PayrollRule;
  holidays: string[];
};

const PAYROLL_RULE_OPTIONS: {
  value: PayrollRule;
  label: string;
  example?: string;
}[] = [
  { value: "prev", label: "앞당겨 들어와요", example: "예: 토요일이면 금요일" },
  { value: "same", label: "날짜 그대로" },
  { value: "next", label: "미뤄서 들어와요", example: "예: 토요일이면 월요일" },
];

// 돈 들어오는 날 picker is grouped into 3 buckets that mirror the 3 distinct
// label/cycle behaviors: 1일 (월초, 「N월」), 특정일 2..28 (range label), 말일
// (월말, 「N+1월」). They map back to user_settings.payday: first->1, last->0,
// mid->the chosen day. payday 29..31 is never offered (true 말일 = 'last').
type PaydayGroup = "first" | "mid" | "last";
const MID_DAY_OPTIONS = Array.from({ length: 27 }, (_, i) => i + 2); // 2..28

function payrollRuleLabel(value: string | null): string {
  return (
    PAYROLL_RULE_OPTIONS.find((opt) => opt.value === value)?.label ?? ""
  );
}

export function SettingsForm({
  initialIncome,
  initialNickname,
  initialPayday,
  initialPayrollRule,
  holidays,
}: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, null);
  const [income, setIncome] = useState(
    initialIncome ? formatNumber(initialIncome) : "",
  );
  const [nickname, setNickname] = useState(initialNickname);
  const [group, setGroup] = useState<PaydayGroup>(
    initialPayday === 0 ? "last" : initialPayday >= 2 ? "mid" : "first",
  );
  const [midDay, setMidDay] = useState<number>(
    initialPayday >= 2 && initialPayday <= 28 ? initialPayday : 25,
  );
  const [payrollRule, setPayrollRule] =
    useState<PayrollRule>(initialPayrollRule);
  // 급여 규정은 기본 접힘 — 주말·공휴일 보정이 필요한 사람만 펼친다(점진적 노출).
  const [ruleOpen, setRuleOpen] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("저장됐어요.");
    } else {
      toast.error(state.error);
    }
  }, [state]);

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

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="nickname">닉네임</Label>
        <p className="text-xs text-muted-foreground">친구가 보는 이름이에요.</p>
        <Input
          id="nickname"
          name="nickname"
          autoComplete="off"
          maxLength={NICKNAME_MAX_LENGTH}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="닉네임을 입력해주세요"
          className="h-12 rounded-2xl bg-card text-[16px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="monthly_income">월 수입</Label>
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
            onChange={(event) => setIncome(formatAmountInput(event.target.value))}
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

      <fieldset className="space-y-3">
        <Label>돈 들어오는 날</Label>
        <p className="text-xs text-muted-foreground">
          월급·용돈처럼 돈이 들어오는 날에 맞춰 소비를 집계해요.
        </p>
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
            <div
              className={cn(
                "grid transition-[grid-template-rows,border-color] duration-200 ease-out motion-reduce:transition-none",
                group === "mid"
                  ? "border-t border-border"
                  : "border-t border-transparent",
              )}
              style={{ gridTemplateRows: group === "mid" ? "1fr" : "0fr" }}
              aria-hidden={group !== "mid"}
            >
              <div className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 bg-muted/60 py-3 pl-11 pr-4">
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
                    <SelectContent>
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

            <div
              id="payroll-rule-panel"
              className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
              style={{ gridTemplateRows: ruleOpen ? "1fr" : "0fr" }}
              aria-hidden={!ruleOpen}
            >
              <div className="overflow-hidden border-t border-border/50">
                <RadioGroup
                  value={payrollRule}
                  onValueChange={(value) =>
                    setPayrollRule((value ?? "prev") as PayrollRule)
                  }
                  className="gap-0"
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

        <input type="hidden" name="payday" value={paydayDb} />
        <input type="hidden" name="payroll_rule" value={payrollRule} />
      </fieldset>

      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-full text-[15px] font-semibold"
      >
        {pending ? "저장 중…" : "저장하기"}
      </Button>
    </form>
  );
}
