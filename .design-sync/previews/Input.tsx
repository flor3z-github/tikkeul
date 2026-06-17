import { Input, Label } from "tikkeul"

export const Default = () => (
  <div style={{ padding: 20, maxWidth: 320 }}>
    <Input placeholder="검색어를 입력하세요" />
  </div>
)

export const WithLabel = () => (
  <div style={{ padding: 20, display: "grid", gap: 6, maxWidth: 320 }}>
    <Label htmlFor="amount">금액</Label>
    <Input id="amount" inputMode="numeric" defaultValue="12,000" />
  </div>
)

export const Disabled = () => (
  <div style={{ padding: 20, maxWidth: 320 }}>
    <Input placeholder="입력할 수 없어요" disabled />
  </div>
)
