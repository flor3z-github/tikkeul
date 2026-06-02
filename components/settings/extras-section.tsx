"use client";

import { Hand } from "lucide-react";
import { toast } from "sonner";

import { LONG_PRESS_GUIDE_FLAG } from "@/components/onboarding/long-press-guide";
import { Button } from "@/components/ui/button";

export function GuideResetButton() {
  function resetGuide() {
    try {
      window.localStorage.removeItem(LONG_PRESS_GUIDE_FLAG);
      toast.success("다음 대시보드 방문에서 안내가 다시 나와요.");
    } catch {
      toast.error("기기에서 안내를 다시 표시할 수 없어요.");
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={resetGuide}
      className="h-12 w-full rounded-full text-[14px] text-muted-foreground"
    >
      <Hand className="mr-2 size-4" aria-hidden />
      기능 안내 다시 보기
    </Button>
  );
}
