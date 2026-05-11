"use client";

import "./globals.css";

export default function GlobalRootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-background px-5 pb-12 pt-12 text-foreground antialiased">
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm font-medium text-muted-foreground">
            티끌에 문제가 생겼어요
          </p>
          <h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em]">
            잠시 후 다시 시도해주세요
          </h1>

          <div className="mt-6 space-y-4 rounded-3xl border border-[rgba(255,59,48,0.2)] bg-[rgba(255,59,48,0.05)] px-5 py-6 text-sm text-[#FF3B30]">
            <p>
              앱이 정상적으로 동작하지 않아요. 새로고침을 시도해주세요.
            </p>
            {error.digest ? (
              <p className="text-xs opacity-70">디버그 ID: {error.digest}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 h-12 w-full rounded-full bg-[#007AFF] text-[15px] font-semibold text-white active:scale-[0.98]"
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
