# 수입 탭 설계 — 하단 navbar 4탭 확장

날짜: 2026-07-20
상태: 사용자 승인 대기 (구성·순서 확정, 스펙 리뷰 전)

## 목적

수입 관련 표면이 세 곳(온보딩 step 2, 설정의 월 수입 필드, 대시보드 income-line + FAB 꾹 누르기)에 흩어져 있고 진입이 깊다. 이를 하단 navbar의 독립 탭 `/income` 하나로 모은다.

동기 (사용자 확인):
1. 수입 전체 현황(월 수입 + 추가 수입 + 주기별 내역)을 한 화면에서 보고 싶다.
2. 월 수입 수정이 설정에 있는 구조가 어색하다.
3. 추가 수입 입력이 FAB 꾹 누르기 뒤에 숨어 너무 깊다.

## 확정 결정

| 항목 | 결정 |
|---|---|
| 탭 구조 | 4탭 확장: 소비 / 고정지출 / 돈모으기 / 수입 (DESIGN.md §6 개정 필요) |
| 새 탭 | `/income` · 라벨 「수입」 · 아이콘 `HandCoins` |
| 정기 수입 모델 | `user_settings.monthly_income` 단일 숫자 유지. DB 변경 없음 |
| 이력 범위 | 주기 네비게이션 (◀ ▶) — 대시보드와 동일한 `month` searchParam + `getCycleRangeB` 패턴 |
| 화면 구성 | 평면 카탈로그형 (/savings 패턴 재사용) |
| 대시보드 정리 | income-line 제거 + FAB 꾹 누르기(추가 수입 진입) 제거. FAB는 탭=지출 추가 단일 동작 |
| 설정 정리 | 월 수입 필드 완전 제거. 온보딩 step 2는 유지 (최초 설정 담당) |
| 추가 버튼 | 리스트 하단 인라인 「+ 추가 수입 기록」 버튼. FAB 아님 |

## 화면 구성 (위→아래)

```
PageHeader  eyebrow="이번 주기 들어온 돈"  title="수입"
◀  주기 라벨 (1월 / M/D–M/D)  ▶
┌ HERO 카드 ────────────────┐
│ 이번 주기 총 수입           │
│ ₩3,250,000                │   ← monthly_income + Σ추가수입. 화면 최대 숫자 (§3 원칙)
│ 월 수입 300만 + 추가 25만   │   ← 한 줄 breakdown
└───────────────────────────┘
[월 수입 행]  "매달 들어오는 돈"  ₩3,000,000  >
   └ 탭 → 금액 수정 drawer (DrawerContent 사용, saveIncomeAction 재사용)
[추가 수입 리스트]  "이번 주기 추가 수입"
   날짜순 · 항목 탭 → 기존 income-form-dialog (수정/삭제)
   빈 상태: "이번 주기엔 추가 수입이 없어요"
[+ 추가 수입 기록]  인라인 버튼 → income-form-dialog (생성 모드)
```

세부 규칙:
- 과거 주기 조회 시 월 수입은 **현재 monthly_income 스냅샷**을 표시한다 (이력 미저장 → 근사치, 알려진 한계).
- 월 수입 수정 행은 **현재 주기에서만** 노출. 과거 주기에서는 읽기 전용 breakdown만.
- 추가 수입은 주기 범위 쿼리라 과거 주기에서도 정확.

## 탭 · 라우팅

- 새 라우트 `app/income/page.tsx` — RSC, `export const dynamic = "force-dynamic"`, `<AppShell withBottomNav>` (FAB 없음).
- `components/layout/bottom-tab-nav.tsx` TABS 배열: `/dashboard` 소비 → `/fixed-expenses` 고정지출 → `/savings` 돈모으기 → `/income` 수입 (이 순서).
- `proxy.ts` matcher 변경 불요 (인증 경로, 공개 경로 아님).
- 친구 모드: bottom nav는 own 모드에서만 렌더(`withBottomNav={isOwn}`) → 수입 탭이 친구 모드에 노출될 경로 없음. `monthly_income` 비공개 원칙 유지.

## 데이터 · 액션

- DB 마이그레이션 **없음**.
- `app/income/page.tsx`: `user_settings.monthly_income` + 주기 범위 `income_adjustments` 조회. 주기 해석은 `resolveDashboardParamsB`/`getCycleRangeB` 재사용.
- 서버 액션: `addIncomeAdjustmentAction` / `updateIncomeAdjustmentAction` / `deleteIncomeAdjustmentAction` (현 `app/dashboard/actions.ts`) + `saveIncomeAction` (현 `app/settings/actions.ts`) → `app/income/actions.ts`로 이동. `revalidatePath`는 `/income`과 `/dashboard` 둘 다 (예산 계산이 monthly_income + 추가수입에 의존).
- 액션 반환 형태 `{ ok } | { ok: false; error }` 관례 유지, sonner 토스트.
- `components/income/*` 재사용: income-form-dialog는 그대로, income-line은 대시보드 전용이므로 삭제하고, 수입 페이지 리스트 아이템은 새 컴포넌트(`components/income/income-item.tsx` 등)로 작성.

## 기존 표면 정리

1. 대시보드: income-line 렌더 제거, FAB 꾹 누르기 진입 제거 (add-transaction-button에서 long-press 분기 삭제). 예산 계산 로직은 무변경.
2. 설정: 월 수입 입력 필드 제거 (`settings-form.tsx`의 income 상태 + saveIncomeAction 호출부).
3. 온보딩: 무변경 (step 2 월 수입 질문 유지, `saveOnboardingAction` 그대로).

## DESIGN.md 개정

- §6: 3탭 → 4탭 (소비 / 고정지출 / 돈모으기 / 수입). "4번째 탭 금지" 문구 갱신.
- §12에 수입 화면 절 신설: 위 화면 구성 + 규칙 반영.
- 수입은 여전히 transaction이 아님 — 「income-as-transactions 제외」 원칙은 유지 (monthly_income + income_adjustments 모델 그대로).

## 테스트 · 검증

- 신규 pure util 없음 → 기존 스위트 green 확인: `pnpm test:run` + `pnpm test:utc`.
- 컴포넌트 테스트 없음 → 최종 시각·동작 검증은 iOS Safari PWA 실기기 (기존 관행).
- 액션 이동 후 대시보드/설정에서 참조 잔존 없는지 타입체크(`next build`)로 확인.

## 알려진 한계 (의도적)

- 월 수입 이력 미저장: 과거 주기의 총 수입은 현재 monthly_income 기준 근사치.
- 정기 수입 항목화(월급/용돈/임대료 리스트) 없음 — 단일 숫자 유지. 필요해지면 별도 설계.
