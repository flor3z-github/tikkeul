import { Skeleton } from "tikkeul"

export const TextLines = () => (
  <div style={{ padding: 20, display: "grid", gap: 10, maxWidth: 320 }}>
    <Skeleton style={{ height: 24, width: "55%" }} />
    <Skeleton style={{ height: 16, width: "90%" }} />
    <Skeleton style={{ height: 16, width: "75%" }} />
  </div>
)

export const CardLoading = () => (
  <div
    style={{
      padding: 20,
      display: "flex",
      gap: 12,
      alignItems: "center",
      maxWidth: 320,
    }}
  >
    <Skeleton style={{ height: 44, width: 44, borderRadius: 9999 }} />
    <div style={{ display: "grid", gap: 8, flex: 1 }}>
      <Skeleton style={{ height: 16, width: "70%" }} />
      <Skeleton style={{ height: 14, width: "40%" }} />
    </div>
  </div>
)
