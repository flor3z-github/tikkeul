import { describe, expect, it } from "vitest";

import { clampToElapsedWindow } from "./elapsed-window";

// spent_at은 경계(자정)에서 멀리(정오 UTC) 둬서 host offset(UTC 0 / KST +9h)이
// 날짜 포함 여부를 뒤집지 못하게 한다 — TZ=UTC와 TZ=Asia/Seoul에서 동일 결과.
const tx = (id: string, isoDay: string) => ({
  id,
  spent_at: `${isoDay}T12:00:00Z`,
  amount: 1000,
});

describe("clampToElapsedWindow", () => {
  // 이번 사이클: [6/1, ...), now = 6/10 → 경과 9일.
  // 직전 사이클: [5/1, 5/31) → cutoff = 5/1 + 9일 = 5/10.
  const cycleStart = new Date(2026, 5, 1); // local midnight (payday 엔진 basis)
  const prevStart = new Date(2026, 4, 1);
  const now = new Date(2026, 5, 10);

  it("경과 윈도우 안의 직전 거래는 유지한다", () => {
    const kept = clampToElapsedWindow([tx("a", "2026-05-05")], cycleStart, prevStart, now);
    expect(kept.map((r) => r.id)).toEqual(["a"]);
  });

  it("컷오프를 지난 직전 거래는 제거한다", () => {
    const kept = clampToElapsedWindow([tx("b", "2026-05-20")], cycleStart, prevStart, now);
    expect(kept).toEqual([]);
  });

  it("컷오프~직전 사이클 끝 사이의 거래도 제거한다", () => {
    const kept = clampToElapsedWindow([tx("c", "2026-05-28")], cycleStart, prevStart, now);
    expect(kept).toEqual([]);
  });

  it("혼합 입력에서 윈도우 안만 남긴다 (prevStart↔cycleStart 스왑·방향 오류 회귀)", () => {
    const rows = [
      tx("a", "2026-05-05"), // keep
      tx("b", "2026-05-20"), // drop
      tx("c", "2026-05-28"), // drop
    ];
    const kept = clampToElapsedWindow(rows, cycleStart, prevStart, now);
    expect(kept.map((r) => r.id)).toEqual(["a"]);
  });

  it("사이클 시작 직후(경과 ~0)면 직전 거래를 거의 모두 잘라낸다", () => {
    const justStarted = new Date(2026, 5, 1, 6, 0, 0); // 6/1 06:00, 경과 6h
    const rows = [tx("a", "2026-05-05"), tx("b", "2026-05-20")];
    const kept = clampToElapsedWindow(rows, cycleStart, prevStart, justStarted);
    expect(kept).toEqual([]);
  });
});
