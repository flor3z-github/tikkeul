"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { redeemFriendCodeAction } from "@/app/friends/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FRIEND_CODE_LENGTH,
  normalizeFriendCodeInput,
} from "@/lib/utils/friend-code";

export function FriendCodeRedeemForm() {
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== FRIEND_CODE_LENGTH) return;
    const formData = new FormData();
    formData.set("code", code);
    startTransition(async () => {
      const result = await redeemFriendCodeAction(null, formData);
      if (result.ok) {
        toast.success("친구를 추가했어요.");
        setCode("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <h2 className="text-base font-semibold">친구 코드 입력</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        친구가 알려준 6자리 코드를 입력해주세요.
      </p>
      <div className="mt-4 space-y-2">
        <Label htmlFor="friend_code" className="sr-only">
          친구 코드
        </Label>
        <Input
          id="friend_code"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
          value={code}
          onChange={(event) =>
            setCode(normalizeFriendCodeInput(event.target.value))
          }
          maxLength={FRIEND_CODE_LENGTH}
          placeholder="예: A3F9K2"
          className="h-14 rounded-2xl text-center text-[24px] font-bold tracking-[0.3em]"
        />
      </div>
      <Button
        type="submit"
        disabled={pending || code.length !== FRIEND_CODE_LENGTH}
        className="mt-4 h-12 w-full rounded-full text-[15px] font-semibold"
      >
        {pending ? "추가 중…" : "친구 추가"}
      </Button>
    </form>
  );
}
