"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, Download } from "lucide-react";
import { toast } from "sonner";

import { saveOnboardingAction } from "@/app/settings/actions";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { AppShell } from "@/components/layout/app-shell";
import { IosInstallSteps } from "@/components/pwa/ios-install-steps";
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
import { cn } from "@/lib/utils";
import { formatAmountInput, parseAmountInput } from "@/lib/utils/money";
import { isValidNickname, NICKNAME_MAX_LENGTH } from "@/lib/utils/nickname";
import type { PayrollRule } from "@/lib/utils/payday-cycle";

// Mirrors settings-form's 돈 들어오는 날 picker: 3 buckets that map to
// user_settings.payday (first->1, last->0, mid->the chosen day 2..28).
type PaydayGroup = "first" | "mid" | "last";
const MID_DAY_OPTIONS = Array.from({ length: 27 }, (_, i) => i + 2); // 2..28

const PAYROLL_RULE_OPTIONS: {
  value: PayrollRule;
  label: string;
  example?: string;
}[] = [
  { value: "prev", label: "앞당겨 들어와요", example: "예: 토요일이면 금요일" },
  { value: "same", label: "날짜 그대로" },
  { value: "next", label: "미뤄서 들어와요", example: "예: 토요일이면 월요일" },
];

const PAYROLL_RULE_SHORT: Record<PayrollRule, string> = {
  prev: "이전 영업일",
  same: "날짜 그대로",
  next: "다음 영업일",
};

const TOTAL_STEPS = 3;

const STEP_COPY = [
  {
    title: "어떻게 불러드릴까요?",
    helper: "친구가 보는 이름이에요. 나중에 바꿀 수 있어요.",
  },
  {
    title: "한 달 수입이 얼마인가요?",
    helper: "매달 들어오는 실수령 금액이요. 예산 계산에 쓰여요.",
  },
  {
    title: "돈은 언제 들어오나요?",
    helper: "월급·용돈이 들어오는 날에 맞춰 소비를 집계해요.",
  },
] as const;

/**
 * First-run onboarding wizard. A single page that reveals one step at a time
 * (닉네임 → 총수입 → 들어오는 날짜) so the user focuses on one field at a time.
 *
 * Reached only via the post-signup redirect (signUpAction → /onboarding); the
 * page server-guards against returning users (redirects to /dashboard once a
 * settings row exists). Skipping is always allowed — the dashboard's
 * "월 수입과 고정지출을 먼저 설정해주세요 →" CTA is the permanent backstop.
 *
 * Steps gate forward progress: 다음 is disabled until the current field is
 * valid. By the time the user reaches step 3 they necessarily have a valid
 * nickname + a positive income, so 시작하기 can never submit a half-filled row.
 */
export function OnboardingFlow({
  initialNickname,
}: {
  initialNickname: string;
}) {
  const router = useRouter();
  const { status: installStatus, promptInstall } = usePwaInstall();
  // Settings come first (saved to the account in the DB), THEN install. On iOS
  // the home-screen PWA has a separate cookie jar from Safari, so installing
  // forces a re-login; doing settings first means they're already persisted
  // server-side when the user re-opens the installed app.
  const [phase, setPhase] = useState<"settings" | "install">("settings");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [nickname, setNickname] = useState(initialNickname);
  const [income, setIncome] = useState("");
  const [group, setGroup] = useState<PaydayGroup>("first");
  const [midDay, setMidDay] = useState(25);
  const [payrollRule, setPayrollRule] = useState<PayrollRule>("prev");
  // 주말·공휴일 보정은 기본 접힘 — 보정이 필요한 사람만 펼친다(점진적 노출).
  const [ruleOpen, setRuleOpen] = useState(false);

  const nicknameValid = isValidNickname(nickname);
  const incomeValid = parseAmountInput(income) > 0;
  const paydayDb = group === "first" ? 1 : group === "last" ? 0 : midDay;

  const canAdvance =
    (step === 1 && nicknameValid) || (step === 2 && incomeValid);

  function goNext() {
    if (step < TOTAL_STEPS && canAdvance) setStep((s) => s + 1);
  }

  function goBack() {
    if (step > 1) setStep((s) => s - 1);
  }

  // Settings done (saved or skipped) → offer install, unless there's genuinely
  // nothing to prompt (already installed, or dismissed within the cooldown),
  // in which case go straight to the dashboard. Everything else — including a
  // not-yet-resolved "loading" status (the hook resolves within a frame of
  // mount, well before the user finishes the wizard) — goes to the install
  // screen, which always offers 웹으로 계속하기 so there's no dead end.
  function finishSettings() {
    if (installStatus === "installed" || installStatus === "dismissed") {
      router.push("/dashboard");
    } else {
      setPhase("install");
    }
  }

  function skip() {
    // Save nothing — the dashboard CTA backstops anyone who skips. Still offer
    // install on the way out.
    finishSettings();
  }

  async function handleSubmit() {
    if (!nicknameValid || !incomeValid || submitting) return;
    setSubmitting(true);
    let ok = false;
    try {
      const res = await saveOnboardingAction(
        nickname.trim(),
        parseAmountInput(income),
        paydayDb,
        payrollRule,
      );
      ok = res.ok;
      if (!res.ok) toast.error(res.error);
    } catch {
      toast.error("저장에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
    if (ok) finishSettings();
  }

  async function handleNativeInstall() {
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      toast.success("앱을 설치했어요");
      router.push("/dashboard");
    }
    // On cancel the user stays on this screen and can tap 웹으로 계속하기.
  }

  // Install phase: shown only after settings, and only when there's actually
  // something to prompt (finishSettings already filtered installed/dismissed).
  if (phase === "install") {
    return (
      <AppShell>
        <div className="flex min-h-[78dvh] flex-col">
          <div className="flex flex-1 flex-col pt-8">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Download className="size-8" aria-hidden />
            </div>
            <h1 className="mt-6 text-[24px] font-bold leading-tight tracking-[-0.03em]">
              앱으로 설치하면 더 편해요
            </h1>
            <p className="mt-2 text-[14px] text-muted-foreground">
              홈 화면에서 바로 열고, 더 빠르게 확인할 수 있어요.
            </p>

            {installStatus === "ios" ? (
              <IosInstallSteps className="mt-8" />
            ) : installStatus === "unsupported" ? (
              <p className="mt-8 rounded-2xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
                브라우저 우측 상단(또는 더보기) 메뉴를 열고{" "}
                <span className="font-medium text-foreground">
                  &lsquo;앱 설치&rsquo; 또는 &lsquo;홈 화면에 추가&rsquo;
                </span>
                를 선택해 주세요.
              </p>
            ) : null}
          </div>

          <div className="mt-8 space-y-3">
            {installStatus === "promptable" ? (
              <Button
                type="button"
                onClick={handleNativeInstall}
                className="h-12 w-full rounded-full text-[15px] font-semibold"
              >
                지금 설치하기
              </Button>
            ) : null}
            <Button
              type="button"
              variant={installStatus === "promptable" ? "ghost" : "default"}
              onClick={() => router.push("/dashboard")}
              className="h-12 w-full rounded-full text-[15px] font-semibold"
            >
              웹으로 계속하기
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const copy = STEP_COPY[step - 1];

  return (
    <AppShell>
      {/* Top bar: back (step > 1) + step indicator + skip */}
      <div className="flex items-center justify-between">
        <div className="flex h-9 items-center">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground"
            >
              <ChevronLeft className="size-4" />
              이전
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={skip}
          className="text-sm font-medium text-muted-foreground"
        >
          건너뛰기
        </button>
      </div>

      {/* Progress dots */}
      <div
        className="mt-6 flex items-center gap-1.5"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label={`${step} / ${TOTAL_STEPS} 단계`}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-200",
              i < step ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>

      {/* Step body — keyed so each step crossfades in */}
      <div key={step} className="mt-8 animate-in fade-in duration-200">
        <h1 className="text-[24px] font-bold leading-tight tracking-[-0.03em]">
          {copy.title}
        </h1>
        <p className="mt-2 text-[14px] text-muted-foreground">{copy.helper}</p>

        <div className="mt-6">
          {step === 1 ? (
            <div className="space-y-2">
              <Label htmlFor="onboarding-nickname">닉네임</Label>
              <Input
                id="onboarding-nickname"
                autoComplete="off"
                enterKeyHint="next"
                maxLength={NICKNAME_MAX_LENGTH}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    goNext();
                  }
                }}
                placeholder="닉네임을 입력해주세요"
                className="h-12 rounded-2xl bg-card text-[16px]"
                autoFocus
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-2">
              <Label htmlFor="onboarding-income">월 수입</Label>
              <div className="relative">
                <Input
                  id="onboarding-income"
                  inputMode="numeric"
                  autoComplete="off"
                  enterKeyHint="next"
                  value={income}
                  onChange={(event) =>
                    setIncome(formatAmountInput(event.target.value))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      goNext();
                    }
                  }}
                  placeholder="예: 3,000,000"
                  className="h-12 rounded-2xl bg-card pr-10 text-[16px]"
                  autoFocus
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground"
                >
                  원
                </span>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
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
                    <RadioGroupItem id="ob-payday-first" value="first" />
                    <span className="text-sm font-semibold">1일</span>
                  </span>
                </div>

                <div
                  role="presentation"
                  onClick={() => setGroup("mid")}
                  className="cursor-pointer border-t border-border p-4"
                >
                  <span className="flex items-center gap-3">
                    <RadioGroupItem id="ob-payday-mid" value="mid" />
                    <span className="text-sm font-semibold">특정일</span>
                  </span>
                </div>

                {/* 며칠 picker — 특정일 선택 시에만 펼쳐짐 */}
                <div
                  className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
                  style={{ gridTemplateRows: group === "mid" ? "1fr" : "0fr" }}
                  aria-hidden={group !== "mid"}
                >
                  <div className="overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/60 py-3 pl-11 pr-4">
                      <Label htmlFor="ob-payday-day" className="text-sm">
                        며칠에 들어오나요
                      </Label>
                      <Select
                        value={String(midDay)}
                        onValueChange={(value) =>
                          setMidDay(Number(value ?? "25"))
                        }
                        disabled={group !== "mid"}
                      >
                        <SelectTrigger
                          id="ob-payday-day"
                          className="h-10 w-28 shrink-0 rounded-xl text-[14px]"
                          tabIndex={group === "mid" ? 0 : -1}
                        >
                          <SelectValue>
                            {(value) => (value ? `${value}일` : "")}
                          </SelectValue>
                        </SelectTrigger>
                        {/* alignItemWithTrigger={false}: plain dropdown below the
                            trigger — see settings-form for why (avoids base-ui's
                            press-drag-release mouseup grace that read as lag). */}
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
                    <RadioGroupItem id="ob-payday-last" value="last" />
                    <span className="text-sm font-semibold">말일</span>
                  </span>
                </div>
              </RadioGroup>

              {/* 주말·공휴일 보정 — 기본 접힘, 현재값 노출 + 펼치면 RadioGroup */}
              <div className="border-t border-border bg-muted/60">
                <button
                  type="button"
                  onClick={() => setRuleOpen((value) => !value)}
                  aria-expanded={ruleOpen}
                  aria-controls="ob-payroll-rule-panel"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <span className="text-sm font-medium text-muted-foreground">
                    주말·공휴일 겹칠 때
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                    {PAYROLL_RULE_SHORT[payrollRule]}
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
                  id="ob-payroll-rule-panel"
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
                            id={`ob-rule-${opt.value}`}
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
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Primary action — 다음(step 1·2) / 시작하기(step 3) */}
      <div className="mt-8">
        {step < TOTAL_STEPS ? (
          <Button
            type="button"
            onClick={goNext}
            disabled={!canAdvance}
            className="h-12 w-full rounded-full text-[15px] font-semibold"
          >
            다음
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="h-12 w-full rounded-full text-[15px] font-semibold"
          >
            {submitting ? "저장 중…" : "시작하기"}
          </Button>
        )}
      </div>
    </AppShell>
  );
}
