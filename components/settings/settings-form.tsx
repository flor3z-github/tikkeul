"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import {
  type CycleMode,
  type PaydayCode,
  PAYDAY_OPTIONS,
  cycleToPayday,
  paydayToCycle,
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
  const [payday, setPayday] = useState<PaydayCode>(
    cycleToPayday(initialCycleMode, initialCycleStartDay),
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("저장됐어요.");
    } else {
      toast.error(state.error);
    }
  }, [state]);

  const mapped = useMemo(() => paydayToCycle(payday), [payday]);
  const cyclePreview = useMemo(() => {
    if (mapped.mode === "calendar") return null; // 평서문으로 따로 안내
    const range = getCycleRange("income_day", mapped.startDay, new Date());
    return formatCycleLabelLong(range.start, range.end);
  }, [mapped]);

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
            onChange={(event) =>
              setIncome(formatNumber(parseAmountInput(event.target.value)))
            }
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
        <Label htmlFor="payday">돈 들어오는 날</Label>
        <p className="text-xs text-muted-foreground">
          월급·용돈처럼 돈이 들어오는 날에 맞춰 소비를 집계해요.
        </p>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-medium">매월</p>
            {mapped.mode === "calendar" ? (
              <p className="text-xs text-muted-foreground">
                이번 달 소비를 1일부터 말일까지 모아서 보여드려요.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                이번 주기: {cyclePreview}
              </p>
            )}
          </div>
          <Select
            value={payday}
            onValueChange={(value) => setPayday(value ?? "1")}
          >
            <SelectTrigger
              id="payday"
              className="h-10 w-28 shrink-0 rounded-xl text-[14px]"
            >
              <SelectValue>
                {(value) =>
                  value === "last" ? "말일" : value ? `${value}일` : ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAYDAY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <input type="hidden" name="cycle_mode" value={mapped.mode} />
        <input type="hidden" name="cycle_start_day" value={mapped.startDay} />
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
