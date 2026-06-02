import { ChevronDown, Plus, Share } from "lucide-react";

import { cn } from "@/lib/utils";

// Shared iOS "add to home screen" instructions. iOS Safari can't trigger a
// programmatic install, so both the dashboard install banner (drawer) and the
// onboarding install screen show these manual steps — keep them in one place
// so the wording never drifts between the two surfaces.
//
// Newer iOS moved 홈 화면에 추가 behind the share sheet's 더 보기(⌄) section,
// so the flow is now 4 steps: 공유 → 더 보기 → 홈 화면에 추가 → 추가.
export function IosInstallSteps({ className }: { className?: string }) {
  return (
    <ol
      className={cn("space-y-4 text-sm text-foreground", className)}
    >
      <li className="flex items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          1
        </span>
        <span className="flex-1">
          Safari 하단(또는 상단)의{" "}
          <Share
            className="inline size-4 align-text-bottom"
            aria-label="공유"
          />{" "}
          공유 버튼을 탭하세요.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          2
        </span>
        <span className="flex-1">
          메뉴를 내려{" "}
          <span className="inline-flex items-center gap-1 font-medium">
            <ChevronDown className="size-4" aria-hidden />
            &lsquo;더 보기&rsquo;
          </span>
          를 탭하세요.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          3
        </span>
        <span className="flex-1">
          <span className="inline-flex items-center gap-1 font-medium">
            <Plus className="size-4" aria-hidden />
            &lsquo;홈 화면에 추가&rsquo;
          </span>
          를 선택하세요.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          4
        </span>
        <span className="flex-1">
          우측 상단의{" "}
          <span className="font-medium">&lsquo;추가&rsquo;</span>를 누르면 홈
          화면에 티끌 앱이 추가돼요.
        </span>
      </li>
    </ol>
  );
}
