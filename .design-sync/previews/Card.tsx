import { Card, CardContent } from "tikkeul"

// Mirrors how the app actually uses Card: a rounded-3xl container holding a
// CardContent list (see components/dashboard/calendar-day-panel.tsx). The app
// composes only Card + CardContent — never CardHeader/CardTitle/CardFooter — so
// the preview does too.

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ padding: 20, maxWidth: 380 }}>{children}</div>
)

const Row = ({ name, amount }: { name: string; amount: string }) => (
  <li
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 12px",
      fontSize: 14,
    }}
  >
    <span>{name}</span>
    <span style={{ fontWeight: 600 }}>{amount}</span>
  </li>
)

export const SpendingList = () => (
  <Frame>
    <Card className="rounded-3xl py-2 shadow-none">
      <CardContent className="p-2">
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          <Row name="점심" amount="₩9,500" />
          <Row name="카페" amount="₩4,800" />
          <Row name="장보기" amount="₩32,000" />
        </ul>
      </CardContent>
    </Card>
  </Frame>
)

export const Empty = () => (
  <Frame>
    <Card className="rounded-3xl py-2 shadow-none">
      <CardContent className="p-2">
        <p
          style={{
            padding: "24px 12px",
            textAlign: "center",
            fontSize: 14,
            color: "var(--muted-foreground)",
          }}
        >
          이 날 기록된 소비가 없어요.
        </p>
      </CardContent>
    </Card>
  </Frame>
)
