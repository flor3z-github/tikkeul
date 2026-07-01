import { clampDayToMonth } from "@/lib/utils/calendar";
import { toISODate } from "@/lib/utils/date";

/**
 * 신용카드 할부(installment) 스케줄 — Phase 2.
 *
 * B1 모델: 할부 1건을 N개월치 자식 거래 행으로 materialize한다. 이 순수 함수는
 * 원금을 회차별 금액·날짜로 쪼개는 부분만 담당한다(행 insert는 RPC, 폼/액션이 호출).
 *
 * 결정(2026-07-01, 사용자 승인):
 * - **구매월 시작**: 1회차 = firstDate(구매일)의 달. 이후 매달. Phase 1 '일시불=당월'과 일관.
 * - **무이자만**: 원금 N등분, 수수료 미모델링.
 * - **우수리 첫 회차**: floor(원금/N) 균등, 나머지(원금 − floor×N)를 1회차에 몰기(한국 카드 관행).
 *   → Σ회차 === 원금 불변식(정수 KRW라 안 나눠떨어지면 마지막이 아니라 첫 회차가 큼).
 *
 * TIMEZONE: 로컬 벽시계 기준으로 날짜를 만든다(new Date(y,m,d) + toISODate) — 결제일이
 * UTC 변환으로 하루 밀리지 않게. 월말 없는 날은 clampDayToMonth로 클램프(1/31 → 2/28).
 */

export type InstallmentEntry = {
  /** 1-based 회차 번호. */
  seq: number;
  /** 이 회차 금액(정수 KRW). seq 1이 우수리를 흡수해 가장 클 수 있다. */
  amount: number;
  /** 회차 결제일, "YYYY-MM-DD" (로컬 날짜). */
  spentAt: string;
};

export const INSTALLMENT_MIN_MONTHS = 2;
export const INSTALLMENT_MAX_MONTHS = 36;

/**
 * 원금·개월·구매일 → 회차 배열. months는 2..36, 원금은 각 회차가 최소 1원이 되도록
 * months 이상이어야 한다(그 외엔 throw — 호출부가 사전 검증하지만 방어).
 */
export function installmentSchedule(
  principal: number,
  months: number,
  firstDate: Date,
): InstallmentEntry[] {
  if (!Number.isInteger(months) || months < INSTALLMENT_MIN_MONTHS) {
    throw new Error("할부 개월 수는 2 이상이어야 해요.");
  }
  if (months > INSTALLMENT_MAX_MONTHS) {
    throw new Error(`할부는 최대 ${INSTALLMENT_MAX_MONTHS}개월까지 가능해요.`);
  }
  if (!Number.isInteger(principal) || principal < months) {
    // 각 회차가 최소 1원이려면 원금 >= 개월 수.
    throw new Error("할부 원금이 개월 수보다 작아요.");
  }

  const base = Math.floor(principal / months);
  const remainder = principal - base * months; // 첫 회차에 몰기
  const year = firstDate.getFullYear();
  const monthIndex0 = firstDate.getMonth();
  const purchaseDay = firstDate.getDate();

  const entries: InstallmentEntry[] = [];
  for (let k = 0; k < months; k++) {
    const absMonth = monthIndex0 + k;
    const y = year + Math.floor(absMonth / 12);
    const m = absMonth % 12; // absMonth >= 0 always → no negative modulo
    const d = clampDayToMonth(y, m, purchaseDay);
    const date = new Date(y, m, d, 0, 0, 0, 0);
    entries.push({
      seq: k + 1,
      amount: base + (k === 0 ? remainder : 0),
      spentAt: toISODate(date),
    });
  }
  return entries;
}
