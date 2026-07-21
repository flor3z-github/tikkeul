# 돈 들어오는 날(payday) 설정을 /settings → /income 이동

**날짜**: 2026-07-21
**상태**: 설계 승인 대기
**관련**: DESIGN.md §12.5(예산 주기)·§12.11(수입 탭)·라우팅표(line 97~98)

## 배경 / 목표

"돈 들어오는 날"(`payday` + 급여 규정 `payroll_rule`) 편집 컨트롤은 현재 `/settings`의 "예산" 섹션에 있다. 이것을 `/income` 탭으로 옮긴다. 월 수입·추가 수입이 이미 `/income`으로 일원화된(DESIGN.md line 901) 선례를 따라, 주기를 정의하는 payday 설정도 수입 화면에 co-locate 한다.

기존 저장 동작은 그대로 보존한다: 값 요약 row → drawer, drawer 안 명시적 "저장" 버튼에서만 commit, backdrop/스와이프/ESC dismiss는 미저장 편집 폐기, 자동저장 인디케이터("저장 중…/저장됨 ✓").

**비목표**: payday 계산 엔진(`lib/utils/payday-cycle.ts`) 변경, 온보딩의 payday 캡처 로직 변경, 급여 규정 UX 재설계.

## 결정 사항 (사용자 확정)

- DESIGN.md도 함께 갱신 (문서-코드 일치 유지).
- /income 배치: 기존 "월 수입" row **아래**, settings-style Card row.
- 표시 범위: **모든 주기**에 노출 (payday는 전역 설정 — 과거/현재/미래 주기 무관하게 편집 가능).

## 온보딩 감사 (사용자 요청)

**결과: 온보딩 기능 변경 불필요 — 이미 일관됨.**

- 온보딩(`app/onboarding/_components/onboarding-flow.tsx`)은 payday·월수입을 자체 inline picker(`ob-payday-*`)로 **최초 캡처**하고 `saveOnboardingAction`이 `user_settings.{payday, payroll_rule, monthly_income}`에 원자적 저장 → `/dashboard`로 client navigate.
- 저장 컬럼이 `/income`이 읽는 것과 동일 shape → 신규 유저 데이터 = 기존 유저 데이터.
- 온보딩에 "/settings에서 돈 들어오는 날 수정" 류 참조 없음(이동으로 깨질 링크 없음). line 47 "나중에 바꿀 수 있어요"는 닉네임 대상.
- `saveOnboardingAction`은 revalidate 없이 navigate → 첫 `/income` 방문이 fresh render라 방금 쓴 payday 반영.

신규 유저 흐름: 온보딩에서 payday 캡처 → 이후 편집은 `/income`(새 위치) → 기존 유저와 동일 경로. **일관성 확인됨.**

## 설계

### 1. 새 컴포넌트 `components/income/payday-cycle-drawer.tsx`

`settings-form.tsx`의 "예산" 섹션(payday trigger row + picker drawer) 전체 로직을 이관한 자기완결 클라이언트 컴포넌트.

- **props**: `initialPayday: number`, `initialPayrollRule: PayrollRule`, `holidays: string[]`.
- **소유 상태**: `group`/`midDay`/`payrollRule`, 마지막 저장 baseline(`savedPayday`/`savedRule`), `ruleOpen`/`pickerOpen`, `committingRef`.
- **로직 이관**: `paydayDb` 도출, `cyclePreview`(`getCurrentCycleB` + `formatCycleLabelLong`), `commitCycle`/`revertCycle`/`confirmCycle`/`handlePickerOpenChange`, `useAutoSave`(cycle) 저장 → `saveCycleAction`.
- **trigger**: `/income`의 "월 수입" row 스타일에 맞춘 Card row — 라벨 "돈 들어오는 날" + 서브텍스트("월급·용돈 들어오는 날") + 값(`cycleSummary`, 예: `25일 · 이전 영업일`) + chevron. 탭 → picker drawer.
- **drawer 본문**: 기존 그대로 — RadioGroup 3버킷(1일/특정일/말일) + midDay native select + 급여 규정 접힘 패널(`CalendarSync`, RadioGroup 3옵션) + cyclePreview + "저장" 버튼.
- **저장 인디케이터**: 저장 진행 중 row에 `SaveIndicator` 노출(위치는 값/chevron 옆, 구현 시 조정).

### 2. 공유 추출

`useAutoSave` 훅 + `SaveIndicator` 컴포넌트는 닉네임(`settings-form`)과 payday(새 컴포넌트) 둘 다 쓰므로 별도 모듈로 추출한다.

- 신규 파일: `components/settings/auto-save.tsx` (export `useAutoSave`, `SaveIndicator`, `SaveStatus`).
- `settings-form.tsx`와 새 컴포넌트가 여기서 import.

payday 전용 상수/헬퍼(`PAYROLL_RULE_OPTIONS`/`PAYROLL_RULE_SHORT`, `groupForPayday`, `MID_DAY_OPTIONS`, `payrollRuleLabel`, `PaydayGroup`)는 새 payday 컴포넌트로 이동.

### 3. payday↔DB 매핑 공유 (optional, 권장)

CLAUDE.md 규약: 매핑이 inline으로 여러 곳에 복제되면 공유 매퍼로 통합. 이동 후에도 온보딩 + income 2곳이 inline이므로, 새 컴포넌트를 만드는 김에 공유 매퍼(`group/midDay ↔ payday smallint`)를 추출해 온보딩·income이 공용한다. `onboarding-flow.tsx`의 stale 주석("Mirrors settings-form's picker")도 갱신.

- 미채택 시: 새 컴포넌트에 inline 복제(현행 2-copy 패턴 유지). 기능상 무해하나 규약 미충족.

### 4. 배치 — `components/income/income-view.tsx`

```
HERO(이번 주기 총 수입)
  → [isCurrentCycle] 월 수입 Card
  → 돈 들어오는 날 Card (항상)  ← 신규
  → 추가 수입 section + FAB
```

`app/income/page.tsx`는 이미 `payday`/`rule`/`holidays`를 로드 중 → `IncomeView`에 전달 → `PaydayCycleDrawer`로 전달.

### 5. `saveCycleAction` — `app/income` revalidate 추가

`app/settings/actions.ts::saveCycleAction`에 `revalidatePath("/income")` 추가(저장 후 주기 경계·라벨 즉시 반영). 기존 `/dashboard`·`/settings`·`/friends` 유지. 액션은 cross-cutting(대시보드·친구도 주기 의존)이라 파일 위치는 `settings/actions.ts` 유지.

### 6. `/settings` 정리

- `settings-form.tsx`: "예산" 섹션(heading + 안내문 + payday trigger + picker drawer) 및 payday 관련 상태·로직·상수·헬퍼 전부 제거. props에서 `initialPayday`/`initialPayrollRule`/`holidays` 제거 → 닉네임 전용 폼으로 축소. `useAutoSave`/`SaveIndicator`는 §2 공유 모듈에서 import(닉네임이 계속 사용).
- `settings/page.tsx`: `holidays` fetch 제거, `user_settings` select에서 `payday, payroll_rule` 제거(알림 필드만 유지), `SettingsForm`에 넘기던 payday/holidays props 제거.

### 7. DESIGN.md 갱신

- 라우팅표(line 97~98): "예산 주기"를 `/settings` 설명에서 빼고 `/income` 설명에 추가.
- §12.5 / line 901 / §12.11: payday picker가 이제 `/income`(새 컴포넌트)에 살고, `settings-form.tsx`는 닉네임 전용이라는 사실 반영.

## 검증

- **util 로직 무변경** → `pnpm test:run`(회귀 확인). date/tz 민감 로직 미변경이라 `test:utc`는 선택.
- **타입** → `pnpm build`(변경 모듈 컴파일).
- **UI 실화면(iOS Safari PWA)** → 사람 확인. 자동 검증은 "util 회귀 없음"만 증명.
  - 확인 포인트: /income 새 row 표시·drawer 열림·저장·dismiss 폐기·인디케이터, /settings 예산 섹션 제거 후 레이아웃, 온보딩 payday 캡처 정상, 신규 유저 첫 /income에서 payday 편집 가능.

## 파일 변경 요약

| 파일 | 변경 |
|---|---|
| `components/income/payday-cycle-drawer.tsx` | 신규 — payday row + picker drawer |
| `components/settings/auto-save.tsx` | 신규 — `useAutoSave`/`SaveIndicator` 추출 |
| `components/income/income-view.tsx` | payday Card row 추가, props 확장 |
| `app/income/page.tsx` | payday/rule/holidays를 IncomeView로 전달 |
| `app/settings/actions.ts` | `saveCycleAction`에 `revalidatePath("/income")` |
| `components/settings/settings-form.tsx` | 예산 섹션·payday 로직 제거, 공유 모듈 import |
| `app/settings/page.tsx` | holidays·payday select·props 제거 |
| `app/onboarding/_components/onboarding-flow.tsx` | (optional §3) 공유 매퍼 사용 + stale 주석 갱신 |
| `DESIGN.md` | §12.5·§12.11·라우팅표 갱신 |
