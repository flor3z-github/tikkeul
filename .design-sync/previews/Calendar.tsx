import { Calendar } from "tikkeul"

export const Single = () => (
  <div style={{ padding: 20 }}>
    <Calendar
      mode="single"
      selected={new Date(2026, 5, 17)}
      defaultMonth={new Date(2026, 5, 17)}
    />
  </div>
)
