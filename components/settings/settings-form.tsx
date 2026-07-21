"use client";
import { useState } from "react";

import { saveNicknameAction } from "@/app/settings/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveIndicator, useAutoSave } from "@/components/settings/auto-save";
import { NICKNAME_MAX_LENGTH } from "@/lib/utils/nickname";

type SettingsFormProps = {
  initialNickname: string;
};

const SECTION_HEADING = "text-[15px] font-semibold tracking-[-0.01em]";

export function SettingsForm({ initialNickname }: SettingsFormProps) {
  const [nickname, setNickname] = useState(initialNickname);

  // Last-saved baseline — auto-save fires only when the live value diverges
  // from this, and it advances on each successful save. (Seeded from props
  // at mount only; no prop→state sync effect, which would clobber editing when
  // a save's revalidatePath refreshes this RSC.)
  const [savedNickname, setSavedNickname] = useState(initialNickname.trim());

  const nicknameSave = useAutoSave();

  // Text fields auto-save on blur. On failure the typed value is KEPT (the
  // standard auto-save behavior) so the user can fix-and-reblur rather than
  // being forced to retype.
  async function handleNicknameBlur() {
    const trimmed = nickname.trim();
    if (trimmed === savedNickname) return;
    const ok = await nicknameSave.save(() => saveNicknameAction(trimmed));
    if (ok) setSavedNickname(trimmed);
  }

  return (
    <section className="space-y-4">
      <h2 className={SECTION_HEADING}>내 정보</h2>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="nickname">닉네임</Label>
          <SaveIndicator status={nicknameSave.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          친구가 보는 이름이에요.
        </p>
        <Input
          id="nickname"
          name="nickname"
          autoComplete="off"
          maxLength={NICKNAME_MAX_LENGTH}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          onBlur={handleNicknameBlur}
          placeholder="닉네임을 입력해주세요"
          className="h-12 rounded-2xl bg-card text-[16px]"
        />
      </div>
    </section>
  );
}
