import { Popover, PopoverTrigger, PopoverContent } from "tikkeul"

export const Open = () => (
  <div style={{ padding: 20, minHeight: 220 }}>
    <Popover defaultOpen>
      <PopoverTrigger>옵션 보기</PopoverTrigger>
      <PopoverContent>
        <div style={{ display: "grid", gap: 8, minWidth: 180 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>주기 설정</div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            돈 들어오는 날을 기준으로 한 달을 계산해요.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
)
