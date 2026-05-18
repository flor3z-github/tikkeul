"use client";

import { useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { usePwaInstall } from "@/hooks/use-pwa-install";

export function PwaInstallBanner() {
  const { status, promptInstall, dismiss } = usePwaInstall();
  const [iosOpen, setIosOpen] = useState(false);
  const [unsupportedOpen, setUnsupportedOpen] = useState(false);

  if (
    status === "loading" ||
    status === "installed" ||
    status === "dismissed"
  ) {
    return null;
  }

  const handleInstallClick = async () => {
    if (status === "promptable") {
      const outcome = await promptInstall();
      if (outcome === "accepted") {
        toast.success("앱을 설치했어요");
      } else if (outcome === "unavailable") {
        // Prompt was consumed between render and click (rare). Fall back.
        setUnsupportedOpen(true);
      }
      return;
    }
    if (status === "ios") {
      setIosOpen(true);
      return;
    }
    setUnsupportedOpen(true);
  };

  return (
    <>
      <div
        className={cn(
          "mt-4 flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10",
        )}
        role="region"
        aria-label="앱 설치 안내"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Download className="size-5" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            홈 화면에 추가하기
          </p>
          <p className="text-xs text-muted-foreground">
            앱처럼 설치하면 더 빠르게 열려요
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={handleInstallClick}
        >
          설치
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="배너 닫기"
          onClick={dismiss}
        >
          <X className="size-4" />
        </Button>
      </div>

      <Drawer open={iosOpen} onOpenChange={setIosOpen}>
        <DrawerContent className="pb-8">
          <DrawerHeader>
            <DrawerTitle>홈 화면에 추가하기</DrawerTitle>
            <DrawerDescription>
              Safari에서 아래 순서대로 진행해 주세요.
            </DrawerDescription>
          </DrawerHeader>
          <ol className="space-y-4 px-4 pb-4 text-sm text-foreground">
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
                메뉴에서{" "}
                <span className="inline-flex items-center gap-1 font-medium">
                  <Plus className="size-4" aria-hidden />
                  &lsquo;홈 화면에 추가&rsquo;
                </span>
                를 선택하세요.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                3
              </span>
              <span className="flex-1">
                우측 상단의{" "}
                <span className="font-medium">&lsquo;추가&rsquo;</span>를 누르면
                홈 화면에 티끌 앱이 추가돼요.
              </span>
            </li>
          </ol>
          <div className="px-4 pb-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setIosOpen(false)}
            >
              확인
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={unsupportedOpen} onOpenChange={setUnsupportedOpen}>
        <DrawerContent className="pb-8">
          <DrawerHeader>
            <DrawerTitle>브라우저 메뉴에서 설치하세요</DrawerTitle>
            <DrawerDescription>
              현재 브라우저에서는 자동 설치를 지원하지 않아요.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 text-sm text-foreground">
            브라우저 우측 상단(또는 더보기) 메뉴를 열고{" "}
            <span className="font-medium">
              &lsquo;앱 설치&rsquo; 또는 &lsquo;홈 화면에 추가&rsquo;
            </span>
            를 선택해 주세요.
          </div>
          <div className="px-4 pb-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setUnsupportedOpen(false)}
            >
              확인
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
