import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <AppShell>
      <PageHeader eyebrow="404" title="페이지를 찾을 수 없어요" />

      <p className="text-sm text-muted-foreground">
        주소가 잘못됐거나 더 이상 존재하지 않는 화면이에요. 대시보드로
        돌아가서 다시 시작해주세요.
      </p>

      <Link
        href="/dashboard"
        className={cn(
          buttonVariants({ variant: "default" }),
          "mt-6 h-12 w-full rounded-full text-[15px] font-semibold",
        )}
      >
        대시보드로 가기
      </Link>
    </AppShell>
  );
}
