/**
 * Dashboard "이번 주기 vs 지난 주기 같은 때" 소비 추세(§3.3, §12.9 분리 결정).
 *
 * /stats는 구성(per-row delta)에 집중하고, 총액 추세는 대시보드의 일이다. 이 모듈은
 * 그 총액 추세를 토스式 페이스 한 줄(DESIGN §12.2)로 표현하기 위한 순수 계산이다.
 * 막대·미니그래프는 §12.1/§19로 대시보드에서 금지 — 추세는 텍스트 한 줄만이다.
 * TIMEZONE-AGNOSTIC: 이미 합산·클램프된 숫자만 받는다(날짜·사이클 경계는
 * payday-cycle.ts / elapsed-window.ts가 먼저 해결).
 *
 * 정직성 두 축:
 *  - 고정분은 `fixedDelta`(matched-only): 직전에 기록만 안 된 변동 공과금이 가짜 +로
 *    잡히는 artifact #1을 제거. 둘 다 값이 있는 항목의 변화만 센다.
 *  - 변동분은 "같은 경과 시점"끼리: 직전 주기를 이번 주기가 지난 시간만큼만 잘라
 *    비교(artifact #2 완화). 이번 측은 자르지 않는다(쓴 돈 불변식 보존).
 * 그래서 `cycleSpendTrend = fixedDeltaWon + (curVariable − prevVariableElapsed)`.
 */

/**
 * 총액 추세 델타(원). 양수 = 지난 주기 같은 때보다 더 씀.
 * 세 입력은 모두 호출부에서 이미 계산된다:
 *  - curVariable: 이번 주기 변동 합(= 대시보드 monthlyTotal)
 *  - prevVariableElapsed: 직전 주기 변동 합을 같은 경과 시점까지 클램프한 값
 *  - fixedDeltaWon: fixedDelta(curFixed, prevFixed) — matched-only
 */
export function cycleSpendTrend(input: {
  curVariable: number;
  prevVariableElapsed: number;
  fixedDeltaWon: number;
}): number {
  return (
    input.fixedDeltaWon + (input.curVariable - input.prevVariableElapsed)
  );
}

/** 델타(원)를 만원 단위 정수로 반올림. |델타| < 5,000이면 0(= "비슷"). */
export function spendTrendManwon(deltaWon: number): number {
  if (!Number.isFinite(deltaWon)) return 0;
  // `|| 0` normalizes the −0 that Math.round yields for small negatives
  // (e.g. −4,999 → −0.4999 → −0), so callers/tests see a clean +0.
  return Math.round(deltaWon / 10_000) || 0;
}

/**
 * 페이스 한 줄을 구성요소로 분해한다. `kind`로 방향(up/down/flat)을 알려주고,
 * 더/덜인 경우 `amount`("N만원")만 떼어 줘서 호출부가 그 숫자만 강조(semibold)
 * 하고 방향 아이콘(↗/↘)을 붙일 수 있게 한다 — 추세 한 줄이 hero 숫자 밑에서
 * 붕 뜨지 않도록(DESIGN §12.2). 색 신호는 budget 상태색과 충돌하지 않게 호출부가
 * 중립으로 두는 것을 전제로, 여기서는 방향 의미만 넘긴다.
 */
export type SpendTrendParts =
  | { kind: "flat"; text: string }
  | { kind: "up" | "down"; prefix: string; amount: string; suffix: string };

export function spendTrend(
  deltaWon: number,
  unit: "달" | "주기" = "주기",
): SpendTrendParts {
  const m = spendTrendManwon(deltaWon);
  if (m === 0) {
    return { kind: "flat", text: `지난 ${unit} 같은 때랑 비슷하게 쓰는 중` };
  }
  const prefix = `지난 ${unit} 같은 때보다 `;
  const amount = `${Math.abs(m)}만원`;
  return m > 0
    ? { kind: "up", prefix, amount, suffix: " 더 쓰는 중" }
    : { kind: "down", prefix, amount, suffix: " 덜 쓰는 중" };
}

/**
 * 페이스 한 줄 카피(plain string). 만원 반올림이 0이면 "비슷하게 쓰는 중", 아니면
 * 더/덜. `spendTrend`를 평문으로 합친 형태 — 강조가 필요 없는 곳(테스트·접근성
 * 텍스트 등)을 위해 유지한다. `unit`은 페이스 라인 관례(calendar="달" /
 * income_day="주기")를 따른다.
 */
export function spendTrendLabel(
  deltaWon: number,
  unit: "달" | "주기" = "주기",
): string {
  const t = spendTrend(deltaWon, unit);
  return t.kind === "flat" ? t.text : `${t.prefix}${t.amount}${t.suffix}`;
}
