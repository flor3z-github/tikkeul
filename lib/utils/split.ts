// N명 나눠내기(정산) 유틸. 소비 1건을 여러 명이 나눠 냈을 때 "내 몫"만 소비로
// 기록하고(= amount), 원래 총액(split_total)과 인원(split_count)은 표시용 메타로
// 남긴다. amount = round(total / people)라 예산·주기·그리드·친구·/stats 등 기존
// 쿼리는 이 행을 일반 거래로 그대로 취급한다(할부 B1과 같은 철학 — 쿼리 무변경).
//
// 반올림 우수리(최대 people-1원)는 소비 인식 앱 특성상 무시한다(예산 정확도에
// 영향 없음). 폼 select가 보여주는 1/N 미리보기 금액과 기록되는 내 몫이 항상 일치하도록
// 미리보기·기록 모두 이 computeShare(총액/N round)를 쓴다.

/** 나눌 수 있는 최소 인원(2명). 1명 = 나누지 않음(no-split). */
export const SPLIT_MIN_PEOPLE = 2;
/** 나눌 수 있는 최대 인원. 폼 select(2~10명)와 DB CHECK가 공유하는 단일 소스. */
export const SPLIT_MAX_PEOPLE = 10;

/** split_count로 유효한 값인지(2..SPLIT_MAX_PEOPLE 정수). null/1 등 no-split은 false. */
export function isValidSplitCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= SPLIT_MIN_PEOPLE &&
    value <= SPLIT_MAX_PEOPLE
  );
}

/**
 * 총액을 people명이 나눴을 때 내 몫(round). people=1이면 나누지 않으므로 총액 그대로.
 * total이 유효하지 않거나 people<1이면 0을 돌려준다(호출부에서 base<=0 가드와 함께 씀).
 */
export function computeShare(total: number, people: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (!Number.isInteger(people) || people < 1) return 0;
  if (people === 1) return Math.round(total);
  return Math.round(total / people);
}
