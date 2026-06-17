import { Switch } from "tikkeul"

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", gap: 16, alignItems: "center", padding: 20 }}>
    {children}
  </div>
)

export const States = () => (
  <Row>
    <Switch defaultChecked />
    <Switch />
    <Switch defaultChecked disabled />
    <Switch disabled />
  </Row>
)

export const Sizes = () => (
  <Row>
    <Switch size="sm" defaultChecked />
    <Switch size="default" defaultChecked />
  </Row>
)
