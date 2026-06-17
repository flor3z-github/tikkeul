import { RadioGroup, RadioGroupItem, Label } from "tikkeul"

const Option = ({ value, children }: { value: string; children: React.ReactNode }) => (
  <Label style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <RadioGroupItem value={value} />
    {children}
  </Label>
)

export const PayrollRule = () => (
  <div style={{ padding: 20, maxWidth: 320 }}>
    <RadioGroup defaultValue="prev">
      <Option value="prev">이전 영업일</Option>
      <Option value="same">당일</Option>
      <Option value="next">다음 영업일</Option>
    </RadioGroup>
  </div>
)
