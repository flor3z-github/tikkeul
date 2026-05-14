import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signUpAction } from "@/app/login/actions";

type SearchParams = {
  error?: string;
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <AppShell>
      <PageHeader eyebrow="처음 오셨군요" title="회원가입" />

      <form action={signUpAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="h-12 rounded-2xl text-[16px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="6자 이상"
            className="h-12 rounded-2xl text-[16px]"
          />
        </div>

        {params.error ? (
          <p
            role="alert"
            className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {params.error}
          </p>
        ) : null}

        <SubmitButton pendingLabel="가입 중...">가입하기</SubmitButton>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        이미 가입했나요?{" "}
        <Link href="/login" className="font-medium text-primary">
          로그인
        </Link>
      </p>
    </AppShell>
  );
}
