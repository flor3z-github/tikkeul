# 예산 주기 Model B (입금 앵커 / 급여→급여) — 합의 스펙

> 상태: 구현 대기. workflow로 설계검증+구현 예정. 이 문서가 단일 출처(source of truth).
> 작성 맥락: 2026-05-30 세션에서 사용자와 합의. context compact 이후 workflow가 이 파일을 읽어 진행.

## 배경 / 결정 경위
- 앱(티끌)의 본질 = **급여 기반 소비 데이터 분석**(사용자 인정). 단순 달력 합계 아님 → cycle을 실제 급여 입금에 앵커링하는 **Model B**로 간다.
- 직전 커밋(`feat/budget-cycle-payday`, "돈 들어오는 날" 단일 Select)에서 picker/라벨 UI는 살리되, **calendar/income_day 2모드 매핑은 폐기**하고 입금앵커 모델로 대체(사용자 OK).
- 경로 = **예측(휴일 테이블 + 급여 규정)**. 관측(occurred_on)이 아니라 예측. 사용자가 휴일 테이블 매년 직접 갱신.

## 모델 공식화 (사용자 확인 완료)
각 유저 설정: **급여일** `payday`(1 / 2~28 / 말일) + **급여 규정** `payroll_rule`(휴일·주말 겹칠 때 입금 보정).

- `영업일` = 토·일 아님 AND 휴일테이블에 없음. (주말은 코드로, 공휴일만 테이블.)
- 월 M 입금일:
  - `명목일` = 말일이면 그달 마지막 날, 아니면 N일.
  - `입금일 = adjustToBusinessDay(명목일, 규정, 휴일)` — prev=직전 영업일 / next=다음 영업일 / same=보정 안 함.
- **주기 앵커** `anchor = 입금일 + (말일 ? +1일 : +0)`.
- **주기** = `[anchor(이달), anchor(다음달))`.
- **라벨 월번호**: 1일·2~28 = 입금월 그대로. 말일 = +1월(다음 달).

### 2026 검증 (규정 = 이전 영업일)
| payday | 예 | 입금일 | 주기 | 라벨 |
|---|---|---|---|---|
| 1일 | 1월 | 1/1(신정·목)→12/31 | [12/31, 1/30) | 1월 |
| 20일 | 1월 | 1/20(화)→1/20 | [1/20, 2/20) | 1/20–2/20 |
| 말일 | 1월 | 1/31(토)→1/30, +1=1/31 | [1/31, 2/28) | 2월 |

통합 규칙: `anchor = adjustedDeposit + (payday===말일 ? 1일 : 0)`.

## 확정 결정
1. **급여 규정**: 사용자 설정 3택(이전/당일/다음 영업일), **기본 '이전 영업일'(prev)**. 한국 기업 대다수.
2. **휴일 저장**: **Supabase `holidays` 테이블**. 전체 인증 유저 읽기 가능(공휴일=비민감). 쓰기는 SQL editor/service role(사용자가 매년 INSERT).
3. **friend cycle = JS 계산**(중요 단순화): 휴일 테이블이 공개읽기라, friend 주기도 `get_user_cycle` RPC가 주는 `(payday, payroll_rule)` 2개 + 공개 휴일로 **클라/서버 JS가 직접 계산**. → SQL 영업일 함수 불필요. RPC는 컬럼 2개만 더 노출(income 여전히 비노출).
4. **주말도 비영업일**로 취급.
5. **경계는 실제로 이동**(Model B 본질). 1월 주기가 12/31 시작될 수 있음 — 의도된 동작.

## 구현 플랜

### DB 마이그레이션 (3건, supabase/migrations/ 다음 번호)
- **M1 `holidays`**: `create table public.holidays (d date primary key, name text)`. RLS on. `select` policy → authenticated(공개 읽기). write policy 없음(SQL editor/service role로만). 초기 시드: 2026 한국 공휴일 INSERT(사용자가 채우거나 샘플 제공).
- **M2 `user_settings` 컬럼 추가**:
  - `payday smallint not null default 1 check (payday between 0 and 28)` — **0 = 말일**(payment-day.ts의 0=말일 관례 재사용), 1..28 = 그 날.
  - `payroll_rule text not null default 'prev' check (payroll_rule in ('prev','same','next'))`.
  - 백필: 기존 `cycle_mode='income_day'`/`cycle_start_day=N(2..28)` → `payday=N`; 레거시 income_day 29~31 → `payday=0`(말일); `calendar`/* → `payday=1`.
    - 주의: calendar는 과거에 1일·말일 둘 다 흡수 → 구분 불가. 일괄 `payday=1`. 말일 유저는 설정서 재선택(소수, 안내 문구).
  - 기존 `cycle_mode`/`cycle_start_day`는 **deprecate 보존**(롤백 여지). 즉시 drop 안 함.
- **M3 `get_user_cycle` 재작성**: returns `(payday smallint, payroll_rule text)`. friendship 게이트 유지. income 비노출 유지. (기존 cycle_mode/cycle_start_day 반환 → payday/payroll_rule로 교체.)

### 엔진 (신규 순수함수, lib/utils/payday-cycle.ts)
- `adjustToBusinessDay(date, rule, holidaySet): Date` — 토·일 또는 휴일이면 prev/next 방향으로 영업일까지 이동, same=그대로.
- `resolveDeposit(year, monthIndex, payday, rule, holidays): Date` — 명목일→실입금일.
- `getCycleRangeB(payday, rule, holidays, anchor, now?): CycleRange` — anchor=입금일+(말일?1:0), `[anchor_이달, anchor_다음달)`. 라벨 월=말일이면 +1월.
- 라벨 헬퍼: 기존 `formatCycleLabel`/`formatCycleLabelLong` 재사용 또는 확장(말일 월번호 +1 반영).
- 기존 `getCycleRange`/`paydayToCycle`/`cycleToPayday`(직전 커밋분) → 이 모델로 **대체**. picker 옵션(`PAYDAY_OPTIONS`)·라벨 UI는 재활용, calendar/income_day 매핑만 제거.

### 휴일 plumbing
- `lib/queries/holidays.ts::getHolidays(yearStart, yearEnd): Set<isoDate>` — Supabase 조회. 연단위 캐시 공격적(거의 안 변함).
- `resolveDashboardParams`가 휴일 주입받아 `getCycleRangeB` 호출. 서버(RSC)서 fetch. 주기가 연 경계 넘을 수 있으니 anchor 연도 ±1 범위 휴일 로드.
- 설정 프리뷰는 클라 계산 → 서버가 해당 연도(±1) 휴일을 settings-form props로 전달.

### 네비게이션
- `?ym` = "라벨 월 M인 주기". 월 스텝 = addMonths 유지, anchor는 월마다 재계산 → 라운드트립 유지.
- 가변 경계 grid = 기존 `buildCycleMatrix`(가변행) 재사용.

### 설정 UI (components/settings/settings-form.tsx)
- picker(1일/2~28/말일) 유지, 라벨 의미만 갱신(입금앵커 기준).
- **급여 규정 Select 추가**: 이전 영업일(기본)/당일/다음 영업일.
- 프리뷰 = 새 입금앵커 주기 + 휴일 반영. 말일은 "2월" 식 다음달 라벨.
- hidden inputs: `payday`, `payroll_rule`로 교체.
- app/settings/actions.ts: `payday`(0~28)/`payroll_rule`(prev/same/next) 검증·저장. 반환 shape `{ok}` 유지.

### friend 모드
- `get_user_cycle`(payday+payroll_rule) + 공개 휴일 → JS로 friend 주기 계산. FriendSwitcher/friend dashboard 경로 갱신. income 비노출.

### 소비자
- 대부분 `cycleStart`/`cycleEnd` props 수신만 → **무변경**.
- 변경점: resolution 레이어(app/dashboard/page.tsx, app/settings/page.tsx), 네비, 설정, friend 경로.

### QA
- 테스트 스위트 없음 → 수동. 엔진은 순수함수라 **최소 단위테스트 권장**(설/추석 연휴 연속 비영업일, 신정 전월 당김, 2월 짧은 달, 연 경계, same/next 규정).
- iOS Safari PWA 실검증.

### 문서
- DESIGN.md §12.5a + CLAUDE.md 예산 주기 = Model B(입금앵커+규정+휴일)로 재작성. payment-day.ts의 0=말일 관례 공유 명시. `holidays` 테이블·`get_user_cycle` 변경·payday/payroll_rule 컬럼 반영.

## 공수 (rough, 숙련 1인)
~6~10일. friend-RPC JS 단순화로 경로2 초기 추정(7~13일)에서 단축.

## workflow 구성 제안
- 조사: 현 cycle resolution/소비자/friend 경로/마이그레이션 번호 매핑(병렬 맵).
- 설계검증: 이 스펙대로 엣지(연휴·연경계·백필·네비 라운드트립·friend privacy) 적대 검토 + 마이그레이션/파일별 편집 스펙 확정.
- 구현: 마이그레이션 → 엔진 → plumbing → 설정 → friend → 문서 (의존순. 단일/소수 에이전트 순차, 충돌 회피).
- 검증: diff 리뷰 + 블로커 수정. 메인서 pnpm lint/build + 순수함수 단위테스트.
