import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signInAction } from "./actions";

type SearchParams = {
  redirectTo?: string;
  error?: string;
  info?: string;
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <AppShell>
      <PageHeader eyebrow="티끌에 어서오세요" title="로그인" />

      <form action={signInAction} className="space-y-4">
        <input
          type="hidden"
          name="redirectTo"
          value={params.redirectTo ?? "/dashboard"}
        />

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
            autoComplete="current-password"
            required
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
        {params.info ? (
          <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">
            {params.info}
          </p>
        ) : null}

        <SubmitButton pendingLabel="로그인 중...">로그인</SubmitButton>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="font-medium text-primary">
          회원가입
        </Link>
      </p>
    </AppShell>
  );
}
