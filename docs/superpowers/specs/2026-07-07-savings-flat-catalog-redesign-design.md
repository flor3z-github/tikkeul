# /savings 재설계 — 목표 제거 + 고정지출식 항목 화면

- 날짜: 2026-07-07
- 상태: 설계 확정 (구현 전)
- 범위: `/savings` (돈모으기) 탭. 대시보드·친구·달력은 **동작 불변**.

## 배경 / 동기

경만님이 돈모으기 탭의 **개념/모델**에 불만. 대화로 좁힌 실제 요구:

1. **목표액(goal_amount) + 달성형 목표 진행바가 의미 없다** — 자유 투자·자유 적립엔 "목표"가 성립하지 않음.
2. **"올해 모은 돈"(YTD 파생 합계)이 적절하지 않다** — projection이라 실제와 안 맞음.
3. **화면이 "어떤 걸 주기적으로 모으는지" 보여주는 카탈로그**였으면 함 — 고정지출 화면처럼 (적립일 + 항목).

핵심 정정: 저축은 **주기적**(적립일 있는 정기 적립)이 맞다. 초기 대화에서 나온 "월별 이벤트 기록 / 이번 달 얼마 모았나" 방향은 **오해였고 폐기**한다. projection 모델(월 적립액 × 적립일 주기)은 유지한다.

## 현재 상태 (요약)

- `savings_plans` 테이블: `name, amount(월 적립), payment_day(적립일), start_date, opening_balance, goal_amount, maturity_date, is_active`.
- `SavingsView` (`components/savings/savings-view.tsx`): 히어로 「매달 모으는 돈」 + 「올해 모은 돈」(YTD), 그 아래 **2섹션** — 「투자·자유 적립」(목표/만기 없음, 숫자만) / 「달성형 목표」(목표 or 만기, **진행바**).
- `lib/utils/savings.ts`: 적립 수학 전부 파생. `depositCount`, `accruedAmount`, `progressPct`, `remainingLabel`, `thisMonthSaved`, `yearSaved`, `depositsOnDate`, `isGoalType`, `isOngoing`.
- `savings_plans` 행은 `goal_amount`/`opening_balance` 포함해 3곳에서 SELECT + 매핑됨: `app/savings/_sections/savings-section.tsx`, `app/dashboard/_sections/spending-summary-section.tsx:288`, `app/stats/page.tsx:154`. 이 두 컬럼은 **row 모양으로만 실리고 계산에는 안 쓰임** (대시보드 히어로는 `thisMonthSaved`(=amount 기반), 달력 마커는 `depositsOnDate`(=start/maturity 기반)만 사용).

## 목표 (Target)

`/savings`를 고정지출 화면(`components/fixed-expenses/fixed-expenses-view.tsx`)과 같은 결의 **"모으는 중" 항목 카탈로그**로 정리한다. 목표액·진행바·YTD를 제거하고, 적립일·월 금액·만기는 유지한다.

### 1. 화면 (`SavingsView` 재작성)

**HERO** (고정지출 히어로 미러)
- 「매달 모으는 돈」 큰 숫자 = 진행 중(active·시작·미만기) 항목의 월 적립액 합 (= 기존 `thisMonthSaved`).
- 우상단 「총 N개 항목」 배지 (active 개수).
- 서브카피 "쓴 게 아니라 **다시 내 자산이 되는 돈**이에요" **유지** (§12.10 브랜드 라인).
- 「올해 모은 돈」 박스 **삭제**.

**항목 리스트** — 「모으는 중」 단일 리스트
- 기존 2섹션(투자·자유적립 / 달성형목표) **폐지** → 평면 리스트 하나.
- 정렬: 적립일 임박순 (`comparePaymentDayUpcoming`, 고정지출과 동일). payment_day 없는 항목은 amount 내림차순 폴백.
- 각 행: 이름 + 「매월 N일」(적립일; 없으면 「적립일 미정」) + 월 금액(없으면 「금액 미입력」).
- **만기 있는 항목**: 보조 라인/라벨로 「만기까지 N개월」 (기존 `remainingLabel`의 만기 분기 재사용). **진행바 없음.**
- **"모은 돈"(누적) 표시 제거** (아래 결정 A).

**추가** — 기존 FAB 위치·동작 유지. 폼에서 목표액·"지금까지 모은 돈" 필드 제거.

**빈 상태** — 기존 Sprout 빈 카드 + 「첫 항목 추가하기」 유지.

### 2. 데이터 / 로직

**마이그레이션 없음 — 코드 온리.** `goal_amount`/`opening_balance` 컬럼은 **deprecated-preserve** (읽기/쓰기만 중단, 컬럼은 남김; `cycle_mode`/`cycle_start_day` 선례). 파괴적 DROP을 피하고 되돌릴 여지를 남긴다. 원할 때 후속 정리 마이그레이션으로 드롭 가능.

- `lib/utils/savings.ts`
  - `SavingsPlanRow` 타입에서 `goal_amount`, `opening_balance` 제거.
  - **제거**: `progressPct`, `accruedAmount`, `yearSaved`, `isGoalType`. `remainingLabel`은 만기 분기만 남기고 목표 분기 제거 (또는 만기 전용 `maturityLabel`로 축소).
  - **유지**: `depositCount`, `isOngoing`, `thisMonthSaved`(대시보드·stats·cycle-breakdown 소비), `depositsOnDate`(달력 마커), `depositDayIn`, 만기 관련.
- `components/savings/savings-form-sheet.tsx`
  - 목표 금액 필드 + 만기와 묶인 그리드의 목표 부분 제거. 만기일 필드는 **단독 유지**.
  - "지금까지 모은 돈"(opening_balance) 필드 + 힌트 제거.
  - `payload`에서 `goal_amount`, `opening_balance` 제거.
  - 삭제 다이얼로그 문구 "모은 돈 합계에서도 즉시 빠져요" → 누적 개념 사라졌으니 "「매달 모으는 돈」 합계에서 빠져요"류로 조정.
- `app/savings/actions.ts` — add/update 액션의 payload 타입·검증에서 `goal_amount`, `opening_balance` 제거. insert/update가 해당 컬럼 미지정(→ DB default null).
- SELECT + row 매핑 3곳에서 `goal_amount`, `opening_balance` 제거:
  - `app/savings/_sections/savings-section.tsx` (SELECT 문자열 + 매핑 라인 37–38)
  - `app/dashboard/_sections/spending-summary-section.tsx` (SELECT 288 + 매핑 366–367)
  - `app/stats/page.tsx` (SELECT 154)
  - → 대시보드/stats **렌더 동작 불변** (두 컬럼은 어차피 계산에 안 쓰였음). SELECT 축소는 비가시.

### 3. 그대로 두는 것 (불변)

- 대시보드 히어로 3분할 「나간 돈 = 모으기 + 고정 + 소비」 (§12.2) — `thisMonthSaved` 그대로 소비.
- 대시보드 달력 저축 녹색 마커 (`depositsOnDate` + payment_day) — 적립일 유지하므로 그대로.
- 친구 노출 RPC `get_friend_savings_total` / `get_friend_savings_items` — `amount`/`payment_day`/`start_date`/`maturity_date`만 참조, goal/opening 미참조 → 손 안 댐.
- `savings_plans` 스키마(컬럼·RLS·트리거) — 물리적으로 불변.

### 4. DESIGN.md 개정 (§12.10)

- 「섹션 A — 투자·자유 적립」/「섹션 B — 달성형 목표」 서술 삭제 → 「모으는 중」 단일 항목 리스트로 개정.
- 히어로 「올해 모은 돈」 서술 삭제, 「총 N개 항목」 배지로 교체.
- "모은 돈은 파생값" 문단(§12.10)에서 목표 대비 진행·goal_amount·opening_balance 언급 정리. 만기 「만기까지 N개월」은 유지.
- §3/§12.2/§12.6은 **개정 불필요** (히어로 핵심 숫자·나간 돈·달력 마커 동작 불변). goal 관련 문구가 있으면만 소거.

## 결정 (확정)

- **(A) 누적 "모은 돈" 표시 제거.** 항목 행은 월 적립액만 보여줌 (고정지출 미러). `opening_balance`/`accruedAmount`/`yearSaved`는 죽은 코드 → 정리. 근거: 티끌은 "지금 뭘 주기적으로 모으는지"만 보여주고, 과거 잔액은 실제 계좌 몫.
- **(B) 평면 리스트.** 투자/적립 구분(kind 컬럼)은 도입하지 않음. 고정지출처럼 구분 없는 단일 리스트. 나중에 필요하면 kind 뱃지로 추가 가능.
- **(C) 만기 유지.** 기간형 상품(청년적금 등) 위해 만기일 필드·「만기까지 N개월」 라벨 존치. 진행바는 없음.
- **(D) 마이그레이션 없음.** goal_amount/opening_balance는 deprecated-preserve (코드에서만 제거).

## 범위 밖 (Out of scope)

- 월별 실제 입금 이벤트 로깅 / `savings_entries` 테이블 (초기 오해 방향 — 폐기).
- 투자 평가액(시세) 반영.
- kind(투자/적립) 컬럼·2섹션.
- 대시보드·친구·달력·stats의 **동작** 변경.
- goal_amount/opening_balance 컬럼 물리 DROP (후속 별건).

## 테스트 (CLAUDE.md: util 변경 시 테스트 먼저)

- `lib/utils/savings.test.ts`: `progressPct`/`accruedAmount`/`yearSaved`/`isGoalType` 테스트 **제거**. `depositCount`/`isOngoing`/`thisMonthSaved`/`depositsOnDate`/만기 `remainingLabel` 테스트 **유지·정리**. 변경 전 회귀 핀 먼저.
- `pnpm test:run` + (날짜 민감) `pnpm test:utc`.
- UI는 util 회귀만 검증 가능 → iOS Safari PWA 실기기 시각 확인은 사람 몫(별도).

## 열린 확인 (구현 중)

- 대시보드 summary/캘린더 section이 `goal_amount`/`opening_balance`를 정말 계산에 안 쓰는지 최종 grep 확인 (현재까지 근거상 row 통과만).
- `remainingLabel` 축소 vs `maturityLabel` 신설 — 구현 시 택1.
