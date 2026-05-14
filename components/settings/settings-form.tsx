"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { saveSettingsAction } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type CycleMode,
  formatCycleLabelLong,
  getCycleRange,
} from "@/lib/utils/calendar";
import { formatNumber, parseAmountInput } from "@/lib/utils/money";
import { NICKNAME_MAX_LENGTH } from "@/lib/utils/nickname";

type SettingsFormProps = {
  initialIncome: number;
  initialNickname: string;
  initialCycleMode: CycleMode;
  initialCycleStartDay: number;
};

export function SettingsForm({
  initialIncome,
  initialNickname,
  initialCycleMode,
  initialCycleStartDay,
}: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, null);
  const [income, setIncome] = useState(formatNumber(initialIncome));
  const [nickname, setNickname] = useState(initialNickname);
  const [cycleMode, setCycleMode] = useState<CycleMode>(initialCycleMode);
  const [startDay, setStartDay] = useState<number>(initialCycleStartDay);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("저장됐어요.");
    } else {
      toast.error(state.error);
    }
  }, [state]);

  const cyclePreview = useMemo(() => {
    if (cycleMode !== "income_day") return null;
    const range = getCycleRange("income_day", startDay, new Date());
    return formatCycleLabelLong(range.start, range.end);
  }, [cycleMode, startDay]);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="nickname">닉네임</Label>
        <Input
          id="nickname"
          name="nickname"
          autoComplete="off"
          maxLength={NICKNAME_MAX_LENGTH}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="닉네임을 입력해주세요"
          className="h-12 rounded-2xl text-[16px]"
        />
        <p className="text-xs text-muted-foreground">
          친구가 보는 이름이에요.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="monthly_income">월 수입</Label>
        <div className="relative">
          <Input
            id="monthly_income"
            name="monthly_income"
            inputMode="numeric"
            autoComplete="off"
            value={income}
            onChange={(event) =>
              setIncome(formatNumber(parseAmountInput(event.target.value)))
            }
            placeholder="예: 3,000,000"
            className="h-12 rounded-2xl pr-10 text-[16px]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground"
          >
            원
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          매달 들어오는 실수령 금액을 입력해주세요.
        </p>
      </div>

      <fieldset className="space-y-3">
        <Label>예산 주기</Label>
        <RadioGroup
          value={cycleMode}
          onValueChange={(value) => setCycleMode(value as CycleMode)}
          className="space-y-2"
        >
          <div
            role="presentation"
            onClick={() => setCycleMode("calendar")}
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <RadioGroupItem
              id="cycle-calendar"
              value="calendar"
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">매월 1일 ~ 말일</span>
              <span className="text-xs text-muted-foreground">
                달력 기준으로 집계해요
              </span>
            </span>
          </div>
          <div
            role="presentation"
            onClick={() => setCycleMode("income_day")}
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <RadioGroupItem
              id="cycle-income"
              value="income_day"
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">
                매월 N일 ~ 다음달 N-1일
              </span>
              <span className="text-xs text-muted-foreground">
                급여일에 맞춰 집계해요
              </span>
            </span>
          </div>
        </RadioGroup>
        <input type="hidden" name="cycle_mode" value={cycleMode} />

        {cycleMode === "income_day" && (
          <div className="ml-2 space-y-2 rounded-2xl bg-muted/40 p-4">
            <Label htmlFor="cycle_start_day">시작일</Label>
            <Select
              value={String(startDay)}
              onValueChange={(value) => setStartDay(Number(value))}
            >
              <SelectTrigger
                id="cycle_start_day"
                className="h-11 rounded-xl text-[15px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day}일
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="cycle_start_day" value={startDay} />
            {cyclePreview && (
              <p className="text-xs text-muted-foreground">
                이번 주기: {cyclePreview}
              </p>
            )}
            {startDay >= 29 && (
              <p className="text-xs text-muted-foreground">
                짧은 달에는 말일을 기준으로 짧아져요. (예: 2월)
              </p>
            )}
          </div>
        )}
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
