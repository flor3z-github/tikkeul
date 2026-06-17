import { Button } from "tikkeul"
import { Plus, Pencil, Trash2 } from "lucide-react"

// Variants/sizes shown match what the app actually reaches for: outline & ghost
// dominate, destructive for deletes, and icon buttons (icon-sm/icon) are common.
// `link` variant and `xs` size exist in the API but the app doesn't use them.

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
    <Button>기본</Button>
    <Button variant="secondary">보조</Button>
    <Button variant="outline">외곽선</Button>
    <Button variant="ghost">고스트</Button>
    <Button variant="destructive">삭제</Button>
  </Row>
)

export const Sizes = () => (
  <Row>
    <Button size="sm">작게</Button>
    <Button size="default">기본</Button>
    <Button size="lg">크게</Button>
  </Row>
)

export const IconButtons = () => (
  <Row>
    <Button size="icon" variant="outline">
      <Plus />
    </Button>
    <Button size="icon-sm" variant="ghost">
      <Pencil />
    </Button>
    <Button size="icon-sm" variant="ghost">
      <Trash2 />
    </Button>
  </Row>
)
