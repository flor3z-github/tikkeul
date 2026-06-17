import { Label, Input, Switch } from "tikkeul"

export const WithInput = () => (
  <div style={{ padding: 20, display: "grid", gap: 6, maxWidth: 320 }}>
    <Label htmlFor="memo">메모</Label>
    <Input id="memo" placeholder="선택 입력 (최대 100자)" />
  </div>
)

export const WithControl = () => (
  <div
    style={{
      padding: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      maxWidth: 320,
    }}
  >
    <Label htmlFor="push">푸시 알림 받기</Label>
    <Switch id="push" defaultChecked />
  </div>
)
