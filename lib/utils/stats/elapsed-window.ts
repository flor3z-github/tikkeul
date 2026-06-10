/**
 * 같은 경과 시점 비교용 컷오프 (§12.9 전월比, 변동지출 한정).
 *
 * /stats의 이번 사이클은 진행 중이라 "지금까지" 쓴 부분합인데, 직전 사이클은
 * 이미 완료된 전체합이다. 그대로 빼면 사이클 초반엔 항상 "덜 썼다(↓)"고 나오는
 * 사과-오렌지 비교가 된다(절약이 아니라 사이클이 막 시작해서). 그래서 직전 사이클
 * 변동지출을 이번 사이클이 지난 경과 시간만큼만 잘라 같은 시점끼리 비교한다:
 *   cutoff = prevStart + (now − cycleStart)
 *
 * 고정지출에는 적용하지 않는다 — 고정은 결제일 하루에 몰린 step이라 같은 컷오프를
 * 적용하면 timing artifact가 생긴다(예: 25일 결제 구독이 컷 밖으로 잘려 직전=0이
 * 되고 가짜 +증가로 표기). 고정은 양쪽 전액 그대로 비교한다(page.tsx의
 * prevFixedItems는 이 함수를 거치지 않음).
 *
 * TZ: cycleStart/prevStart는 payday 엔진의 host-local Date(localMidnight),
 * now는 nowInSeoul()로 같은 basis라 `now − cycleStart`(elapsed)는 host offset이
 * 상쇄돼 TZ 무관하다. cutoff(host-local Date 기반)를 `new Date(spent_at)`(실제
 * instant)와 getTime()으로 비교하는 것은, 기존 윈도우 쿼리가 `spent_at`을
 * `cycle.toISOString()` 경계로 거르는 것과 동일하게 일관된다.
 */
export function clampToElapsedWindow<T extends { spent_at: string }>(
  prevRows: T[],
  cycleStart: Date,
  prevStart: Date,
  now: Date,
): T[] {
  const elapsedMs = now.getTime() - cycleStart.getTime();
  const cutoffMs = prevStart.getTime() + elapsedMs;
  return prevRows.filter((row) => new Date(row.spent_at).getTime() < cutoffMs);
}
