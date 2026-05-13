"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { saveSettingsAction } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber, parseAmountInput } from "@/lib/utils/money";
import { NICKNAME_MAX_LENGTH } from "@/lib/utils/nickname";

type SettingsFormProps = {
  initialIncome: number;
  initialNickname: string;
};

export function SettingsForm({ initialIncome, initialNickname }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, null);
  const [income, setIncome] = useState(formatNumber(initialIncome));
  const [nickname, setNickname] = useState(initialNickname);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("저장됐어요.");
    } else {
      toast.error(state.error);
    }
  }, [state]);

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
