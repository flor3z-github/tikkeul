import { Badge } from "tikkeul"

const Row = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center",
      padding: 20,
    }}
  >
    {children}
  </div>
)

export const Variants = () => (
  <Row>
    <Badge>기본</Badge>
    <Badge variant="secondary">보조</Badge>
    <Badge variant="destructive">위험</Badge>
    <Badge variant="outline">외곽선</Badge>
    <Badge variant="ghost">고스트</Badge>
  </Row>
)

export const InContext = () => (
  <Row>
    <Badge>3</Badge>
    <Badge variant="secondary">NEW</Badge>
    <Badge variant="destructive">예산 초과</Badge>
    <Badge variant="outline">고정지출</Badge>
  </Row>
)
