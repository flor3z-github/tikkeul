---
version: alpha
name: Tikkeul Design System
description: A clean, calm, mobile-first design system for 티끌, a personal spending awareness PWA built with shadcn/ui and Tailwind CSS.
---

# 티끌 Design System

## 1. Purpose

이 문서는 개인 소비 확인용 PWA **티끌**의 시각 디자인 시스템을 정의한다.

티끌은 복잡한 가계부나 자산관리 앱이 아니다. 사용자가 다음 정보를 빠르게 확인하도록 돕는 미니멀 소비 확인 앱이다.

- 이번 달 총 소비 금액
- 월 가용 예산 대비 소비율
- 최근 소비 내역
- 날짜별 소비 흐름

UI는 차분하고, 읽기 쉽고, 터치 친화적이어야 한다. 화면에 보이는 정보는 적어야 하며, 핵심 숫자가 가장 먼저 보여야 한다.

Apple 스타일의 여백, 둥근 형태, 부드러운 표면감은 참고하되 Apple 브랜드, 아이콘, 고유 UI를 복제하지 않는다.

---

## 2. Brand

```yaml
brand:
  appName: 티끌
  shortName: 티끌
  description: 월 수입 대비 소비율을 간단히 확인하는 개인용 PWA
  styleKeywords:
    - minimal
    - calm
    - mobile-first
    - fast expense entry
    - focused spending awareness
    - soft depth
    - high readability
```

브랜드 방향은 다음과 같다.

- 작고 가볍게 기록한다.
- 복잡한 회계 앱처럼 보이지 않는다.
- 오늘 얼마나 썼는지보다, 이번 달 흐름을 쉽게 보여준다.
- 수입, 고정지출, 가용 예산, 소비율의 관계를 명확하게 보여준다.
- 소비 추가는 언제나 빠르게 가능해야 한다.

---

## 3. Design Principles

### 3.1 핵심 숫자 우선

홈 화면에서 가장 먼저 보여야 하는 것은 이번 달 총 소비 금액이다.

그다음은 월 가용 예산 대비 소비율이다.

```txt
이번 달 소비
690,000원

가용 예산 2,300,000원 중 30% 사용
```

대시보드 `PageHeader`의 title은 모드 무관하게 브랜드명 "티끌"로 고정한다. 사이클 정보는 합계 카드 아래 MonthSwitcher 라벨(`5월` 또는 `5/20 – 6/19`)이 전담한다. 사용자가 "내 급여일" 모드(§12.5a)를 켜면 MonthSwitcher 라벨과 캘린더 그리드가 사이클 기준으로 바뀐다. 합계 카드의 "총 소비 / N원"이 핵심 숫자 자리를 유지한다.

### 3.2 기능보다 명료함 우선

MVP에서는 다음 기능을 과하게 강조하지 않는다.

- 복잡한 분석
- 통계 차트
- 카테고리별 Top 5
- 수입 내역 관리
- 전체 거래 내역 페이지

### 3.3 한 화면에 하나의 목적

각 화면의 목적은 명확해야 한다.

```txt
/dashboard       현재 소비 상태 확인 (결과). 친구 모드는 ?viewing=<friendId> 쿼리
/fixed-expenses  매달 빠지는 돈 구성 관리 (구성)
/friends         친구 코드 발급/입력, 친구 목록 (§12.8)
/settings        월 수입·예산 주기·닉네임·로그아웃 (보조)
/login           로그인
/signup          회원가입
```

캘린더는 별도 라우트가 아니라 대시보드에 임베드된다 (§12.6).

### 3.4 빠른 소비 입력

소비 추가는 화면 오른쪽 아래 Floating Action Button으로 시작한다.

소비 입력 필드는 다음 3개를 핵심으로 한다.

- 카테고리
- 금액
- 날짜

여기에 짧은 식별을 위한 선택 필드 1개가 더해진다.

- 메모 (선택, 최대 100자)

---

## 4. Color System

### 4.1 Light Mode

```yaml
colors:
  background: "#F5F5F7"
  foreground: "#111827"
  surface: "#FFFFFF"
  surface-elevated: "#FFFFFF"
  surface-muted: "#F2F2F7"
  surface-glass: "rgba(255, 255, 255, 0.72)"
  border: "rgba(17, 24, 39, 0.08)"
  border-strong: "rgba(17, 24, 39, 0.14)"
  muted: "#6B7280"
  muted-foreground: "#8E8E93"
  primary: "#007AFF"
  primary-foreground: "#FFFFFF"
  secondary: "#E5E5EA"
  secondary-foreground: "#111827"
  accent: "#EEF5FF"
  accent-foreground: "#0057D9"
  success: "#34C759"
  warning: "#FF9500"
  danger: "#FF3B30"
```

### 4.2 Dark Mode

```yaml
colorsDark:
  background: "#000000"
  foreground: "#F9FAFB"
  surface: "#1C1C1E"
  surface-elevated: "#2C2C2E"
  surface-muted: "#111113"
  surface-glass: "rgba(28, 28, 30, 0.72)"
  border: "rgba(255, 255, 255, 0.10)"
  border-strong: "rgba(255, 255, 255, 0.16)"
  muted: "#A1A1AA"
  muted-foreground: "#8E8E93"
  primary: "#0A84FF"
  primary-foreground: "#FFFFFF"
  secondary: "#2C2C2E"
  secondary-foreground: "#F9FAFB"
  accent: "#0B1D33"
  accent-foreground: "#8EC5FF"
  success: "#30D158"
  warning: "#FF9F0A"
  danger: "#FF453A"
```

### 4.3 Color Usage Rules

파란색은 주요 액션과 선택 상태에만 사용한다.

사용 예:

- 소비 추가 버튼
- 선택된 카테고리
- 활성 progress bar
- 설정 저장 버튼

빨간색은 다음 상황에만 사용한다.

- 소비율 100% 초과
- 삭제 기능이 생길 경우 삭제 액션

주황색은 다음 상황에만 사용한다.

- 소비율이 위험 구간에 가까워지는 상태

초록색은 MVP에서 거의 사용하지 않는다. 티끌은 수입 내역을 transaction으로 관리하지 않기 때문이다.

---

## 5. Typography

티끌의 기본 폰트는 **Pretendard**를 사용한다.

```yaml
fontFamily:
  sans: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
```

권장 설치 방식:

```bash
pnpm add @fontsource/pretendard
```

`app/layout.tsx` 또는 전역 스타일 진입점에서 다음을 import한다.

```ts
import "@fontsource/pretendard/variable.css"
```

Tailwind 설정 예시:

```ts
fontFamily: {
  sans: [
    "Pretendard Variable",
    "Pretendard",
    "-apple-system",
    "BlinkMacSystemFont",
    "system-ui",
    "sans-serif",
  ],
}
```

### 5.1 Type Scale

```yaml
typography:
  display:
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "1.08"
    letterSpacing: "-0.035em"

  h1:
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "1.15"
    letterSpacing: "-0.03em"

  h2:
    fontSize: "22px"
    fontWeight: 650
    lineHeight: "1.22"
    letterSpacing: "-0.025em"

  h3:
    fontSize: "18px"
    fontWeight: 650
    lineHeight: "1.3"
    letterSpacing: "-0.015em"

  body:
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.55"
    letterSpacing: "-0.01em"

  body-sm:
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.45"
    letterSpacing: "-0.006em"

  label:
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "1.25"
    letterSpacing: "-0.004em"

  caption:
    fontSize: "12px"
    fontWeight: 450
    lineHeight: "1.25"
    letterSpacing: "0"

  number-xl:
    fontSize: "40px"
    fontWeight: 750
    lineHeight: "1"
    letterSpacing: "-0.045em"

  number-lg:
    fontSize: "30px"
    fontWeight: 720
    lineHeight: "1.05"
    letterSpacing: "-0.04em"
```

### 5.2 Typography Rules

금액 숫자는 크고 굵게 보여준다.

한국어 UI에서는 지나치게 좁은 letter spacing을 피한다. 큰 숫자와 제목에만 약한 negative letter spacing을 사용한다.

한 카드 안에서 font weight를 너무 많이 섞지 않는다.

---

## 6. Layout

### 6.1 Mobile Layout

티끌은 모바일 우선 PWA다.

기본 레이아웃은 단일 컬럼이다.

```tsx
<main className="min-h-dvh bg-background px-5 pb-28 pt-4 text-foreground">
  <div className="mx-auto w-full max-w-md">
    {children}
  </div>
</main>
```

하단 탭 네비게이션은 다음 2탭만 사용한다 (§11.2 참조).

- 이번 달 → `/dashboard`
- 고정지출 → `/fixed-expenses`

설정은 하단 탭에 넣지 않고 대시보드 우상단 설정 아이콘으로 진입한다.

대시보드에는 소비 추가 Floating Action Button을 화면 오른쪽 아래에 고정한다. FAB은 하단 탭 위로 떠 있게 배치한다.

```tsx
<Button
  aria-label="소비 추가"
  className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg active:scale-[0.98]"
>
  <PlusIcon className="size-6" />
</Button>
```

safe area를 고려할 경우:

```tsx
className="fixed right-6 bottom-[max(24px,env(safe-area-inset-bottom))]"
```

### 6.2 Width Constraints

데스크톱에서도 모바일 앱처럼 좁고 집중된 레이아웃을 유지한다.

```tsx
<div className="mx-auto w-full max-w-md">
  {children}
</div>
```

금융 대시보드를 넓은 화면 전체로 늘리지 않는다.

### 6.3 Spacing

```yaml
spacing:
  micro: "4px"
  compact: "8px"
  field-gap: "12px"
  standard: "16px"
  screen-x: "20px"
  section: "28px"
  large: "32px"
  fab-bottom-space: "96px"
```

---

## 7. Surfaces, Radius, and Depth

### 7.1 Surfaces

기본 카드는 흰색 또는 다크 표면을 사용한다.

```tsx
<Card className="rounded-3xl border border-black/[0.08] bg-white shadow-none dark:border-white/[0.10] dark:bg-[#1C1C1E]">
  <CardContent className="p-5">
    {children}
  </CardContent>
</Card>
```

glass surface는 다음에만 제한적으로 사용한다.

- sticky header
- floating sheet
- 향후 calendar 월 이동 header

bottom navigation은 backdrop-blur + 반투명 background로 단순하게 처리한다. iOS Safari 류의 글래스모피즘은 사용하지 않는다 (§19).

### 7.2 Radius

```yaml
radius:
  chip: "9999px"
  input: "18px"
  button: "9999px"
  card: "24px"
  summary-card: "28px"
  sheet: "28px"
  fab: "9999px"
```

### 7.3 Shadow

무거운 그림자를 남발하지 않는다.

그림자는 다음에만 사용한다.

- Floating Action Button
- Dialog / Sheet
- 일시적으로 떠 있는 panel

---

## 8. Motion

Motion은 빠르고 조용해야 한다.

```tsx
className="transition-all duration-200 ease-out active:scale-[0.98]"
```

사용 예:

- 버튼 누름
- dialog open/close
- category chip 선택
- 저장 후 리스트 갱신

bouncy하거나 과한 애니메이션은 사용하지 않는다.

reduced motion 환경을 고려한다.

---

## 9. shadcn/ui Usage

shadcn/ui를 기본 컴포넌트 시스템으로 사용한다.

권장 컴포넌트:

- Button
- Card
- Input
- Label
- Dialog
- Sheet
- Badge
- Select
- Calendar
- Popover
- Toast 또는 Sonner

MVP에서 Tabs, Bottom Navigation, 복잡한 Chart 컴포넌트는 사용하지 않는다.

### 9.1 Button

```tsx
<Button className="h-12 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground active:scale-[0.98]">
  저장하기
</Button>
```

### 9.2 Floating Action Button

```tsx
<Button
  aria-label="소비 추가"
  size="icon"
  className="fixed right-6 z-50 size-14 rounded-full bg-primary text-primary-foreground shadow-[0_12px_40px_rgba(0,0,0,0.18)] active:scale-[0.96]"
>
  <PlusIcon className="size-6" />
</Button>
```

### 9.3 Input

```tsx
<Input className="h-12 rounded-2xl border-black/[0.08] bg-white px-4 text-[16px] shadow-none focus-visible:ring-2 focus-visible:ring-primary/20 dark:border-white/[0.10] dark:bg-[#1C1C1E]" />
```

금액 입력은 더 크게 만든다.

```tsx
<input
  inputMode="numeric"
  className="w-full bg-transparent text-center text-[40px] font-bold tracking-[-0.045em] outline-none"
  placeholder="0"
/>
```

### 9.4 Sheet / Dialog

소비 추가와 수정은 같은 form 컴포넌트를 재사용한다.

```tsx
type TransactionFormMode = "create" | "edit"
```

Sheet 스타일:

```tsx
<SheetContent className="rounded-t-[28px] border-white/10 bg-background px-5 pb-8 pt-4">
  {children}
</SheetContent>
```

---

## 10. Tailwind CSS Mapping

`globals.css`에서 shadcn/ui와 Tailwind가 같은 token을 사용하도록 한다.

```css
@import "@fontsource/pretendard/variable.css";

:root {
  --background: 245 245 247;
  --foreground: 17 24 39;
  --card: 255 255 255;
  --card-foreground: 17 24 39;
  --popover: 255 255 255;
  --popover-foreground: 17 24 39;
  --primary: 0 122 255;
  --primary-foreground: 255 255 255;
  --secondary: 229 229 234;
  --secondary-foreground: 17 24 39;
  --muted: 242 242 247;
  --muted-foreground: 142 142 147;
  --accent: 238 245 255;
  --accent-foreground: 0 87 217;
  --destructive: 255 59 48;
  --destructive-foreground: 255 255 255;
  --border: 17 24 39 / 0.08;
  --input: 17 24 39 / 0.08;
  --ring: 0 122 255;
  --radius: 1.125rem;
}

.dark {
  --background: 0 0 0;
  --foreground: 249 250 251;
  --card: 28 28 30;
  --card-foreground: 249 250 251;
  --popover: 44 44 46;
  --popover-foreground: 249 250 251;
  --primary: 10 132 255;
  --primary-foreground: 255 255 255;
  --secondary: 44 44 46;
  --secondary-foreground: 249 250 251;
  --muted: 17 17 19;
  --muted-foreground: 142 142 147;
  --accent: 11 29 51;
  --accent-foreground: 142 197 255;
  --destructive: 255 69 58;
  --destructive-foreground: 255 255 255;
  --border: 255 255 255 / 0.10;
  --input: 255 255 255 / 0.10;
  --ring: 10 132 255;
}

body {
  font-family:
    "Pretendard Variable",
    Pretendard,
    -apple-system,
    BlinkMacSystemFont,
    system-ui,
    sans-serif;
}
```

---

## 11. App Shell

티끌의 App Shell은 네이티브 모바일 앱처럼 단순해야 한다.

### 11.1 Header

```tsx
<header className="mb-6">
  <p className="text-sm font-medium text-muted-foreground">이번 달 소비를 가볍게 확인해요</p>
  <h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em]">티끌</h1>
</header>
```

### 11.2 Bottom Tab Navigation (2탭)

대시보드와 고정지출은 동급의 메인 화면이다. 둘 사이를 빠르게 오갈 수 있도록 화면 하단에 2탭 네비게이션을 둔다.

```txt
[ 이번 달 ]   [ 고정지출 ]
 /dashboard    /fixed-expenses
```

원칙:

- 탭은 항상 2개다. 설정, 캘린더 등은 탭에 넣지 않는다.
- 설정은 대시보드 우상단 아이콘으로 진입한다.
- 활성 탭은 아이콘에 primary 색을 적용하고 라벨은 foreground로, 비활성 탭은 muted-foreground로 표시한다.
- 컨테이너 너비는 max-w-md 단일 컬럼과 정렬해야 한다.
- safe-area-inset-bottom을 고려한 padding을 둔다.
- 하단 탭이 있는 화면(`/dashboard`, `/fixed-expenses`)은 AppShell에 `withBottomNav` prop을 넘긴다. `/settings`는 넘기지 않는다 (탭 노출 X).

대시보드 추가 진입점:

- 오른쪽 아래 소비 추가 FAB (탭 위로 떠 있음, 친구 모드에서는 숨김)
- 우상단 헤더 trailing — 좌측 `FriendSwitcher`(시트로 본인 ↔ 친구 전환, 친구 모드는 `?viewing=<friendId>` 쿼리), 우측 설정 아이콘
- 캘린더는 별도 라우트가 아니라 대시보드에 임베드된다 (§12.1, §14 참조).
- 친구 모드 동작 전체는 §12.8.5 참조.

---

## 12. Screen Guidelines

### 12.1 Dashboard

Dashboard는 다음 질문에 답해야 한다.

- 선택한 달에 총 얼마를 썼는가?
- 가용 예산 중 몇 퍼센트를 썼는가?
- 그 달에 어떤 날 얼마를 썼는가? (일별 흐름)
- 특정 날짜에 무엇을 기록했는가?

권장 구조:

```txt
Header
MonthSwitcher  ← ◀ "5월" ▶
MonthlySummaryCard
SpendingCalendar  ← 7×6 month grid
DayTransactions   ← 선택 날짜 거래 목록
FloatingAddTransactionButton
```

대시보드는 `?ym=YYYY-MM&day=YYYY-MM-DD` 쿼리로 선택 월·일을 보관한다. 월 이동 시 합계 카드 / 캘린더 / 일별 거래 목록 세 영역이 모두 갱신된다.

Dashboard에서 보여주지 않을 것:

- 카테고리 Top 5
- 복잡한 차트 / 미니 그래프
- 오늘 지출 카드
- 수입 내역
- 분석 그래프
- 지난달 대비 비교 문구

### 12.2 Spending Summary Card

가장 중요한 카드다.

```txt
이번 달 소비
690,000원

가용 예산 2,300,000원 중 30% 사용
[progress bar]
```

소비율 상태:

```txt
0% - 59%: 정상
60% - 89%: 주의
90% - 99%: 위험
100% 이상: 초과
```

색상:

- 정상: primary
- 주의: warning
- 위험/초과: danger

### 12.3 Add / Edit Transaction

소비 추가와 수정은 같은 UI를 사용한다.

입력 필드:

- 카테고리
- 금액
- 메모 (선택, 최대 100자)
- 날짜

추가 모드:

```txt
소비 추가
[카테고리]
[금액]
[메모]
[날짜]
[추가하기]
```

수정 모드:

```txt
소비 수정
[카테고리]
[금액]
[메모]
[날짜]
[수정하기]
[삭제하기]
```

메모 필드 규칙:

- 한 줄 텍스트 입력, placeholder "무엇에 썼나요?".
- 최대 100자. 입력란 우측 상단에 `현재길이/100` 카운터를 표시한다.
- 비워두면 저장 시 `null`로 정규화한다 (앞뒤 공백 제거 후 빈 문자열도 동일).
- 메모를 비우거나 수정하는 것이 곧 추가/수정/삭제다. 별도 메모 삭제 액션은 두지 않는다.

수정 모드에서만 `삭제하기` 버튼을 노출한다. destructive variant 스타일로 `수정하기` 바로 아래 둔다.

삭제는 다음 규칙을 따른다.

- 클릭 시 AlertDialog로 확인을 한 번 받는다 (제목: "이 소비를 삭제할까요?", 본문: "삭제한 소비는 목록과 합계에서 즉시 사라져요.").
- DB는 row를 즉시 제거하지 않고 `transactions.deleted_at`을 채우는 soft delete를 사용한다. 모든 조회 쿼리는 `deleted_at is null` 조건을 함께 건다.
- 사용자에게는 휴지통/복구 UI를 제공하지 않는다 — soft delete는 운영상 복구 여지를 남기기 위한 장치일 뿐, MVP UI 표면에는 hard delete처럼 보인다.

### 12.4 Recent Transactions

최근 소비 내역은 최대 5개만 보여준다.

각 항목은 다음만 표시한다.

- 카테고리
- 날짜
- 금액

예시:

```txt
식비        5월 11일        12,000원
카페        5월 10일         5,500원
교통        5월 10일         1,500원
```

항목을 누르면 수정 Sheet 또는 Dialog를 연다.

### 12.5 Settings

Settings에서는 다음만 관리한다.

- 닉네임 — 친구가 보는 이름. 가입 시 한국어 자동 닉네임이 시드되며, 최대 20자, 공백/탭/줄바꿈 금지. 빈값이면 친구 화면에서 "이름 없음"으로 폴백 (§12.8.7)
- 월 수입
- 예산 주기 (§12.5a)
- 월 고정지출 — 합계 표시 + `/fixed-expenses`로 진입하는 링크 카드
- 로그아웃

닉네임 섹션 보조 카피에는 친구 수와 `/friends` 진입 링크를 함께 노출한다 — 친구가 0명일 때 "친구 추가 →", 1명 이상일 때 "친구 N명 →" (§12.8.4).

월 고정지출은 더 이상 단일 숫자 입력 필드가 아니다.
별도 화면 `/fixed-expenses`에서 항목별로 관리한다. 자세한 내용은 §12.7 참조.

향후 확장 가능 항목:

- 카테고리 관리
- 앱 잠금
- 데이터 내보내기

MVP에서는 노출하지 않는다.

### 12.5a Budget Cycle

예산 집계 주기는 두 가지 모드를 가진다.

- **달력 기준 (`calendar`, 기본)** — 매월 1일부터 그 달 말일까지. 가입 시 기본값이며 모든 기존 사용자에게 회귀 없이 적용된다.
- **급여일 기준 (`income_day`)** — 매월 시작일 N(1~31)에 시작해 다음 달 N-1일 끝, 즉 다음 사이클 직전까지. 사용자가 시작일을 1~31 중에서 직접 선택한다.

UI 구성 (월 수입 입력 다음):

- RadioGroup 두 옵션 (라벨 + 보조 설명 한 줄).
- `income_day` 선택 시에만 점선 박스가 나타나 다음을 노출한다.
  - 시작일 Select (1일~31일)
  - "이번 주기" 미리보기 텍스트 (예: "5월 20일 – 6월 19일")
  - `startDay >= 29`인 경우 헬퍼: "짧은 달에는 말일을 기준으로 짧아져요. (예: 2월)"

짧은 달 처리 규칙: 시작일이 그 달에 존재하지 않으면(예: 2월 31일) 자동으로 그 달의 말일로 clamp된다. 사이클 자체가 짧아지며, 다음 사이클은 다음 달의 (clamp된) 시작일에 다시 시작한다.

친구 대시보드는 친구 본인의 사이클을 그대로 사용한다. 친구의 `monthly_income`은 노출하지 않으며, 사이클 정보(`cycle_mode`, `cycle_start_day`)만 `get_user_cycle` RPC로 가져온다. RPC는 friendship 관계가 있는 viewer에게만 row를 반환한다. 친구 모드 대시보드의 화면 동작 전체는 §12.8.5 참조.

### 12.7 Fixed Expenses

`/fixed-expenses`에서 매달 빠지는 항목(월세, 통신비, 보험, 구독 등)을 개별 항목으로 관리한다. 대시보드가 "결과 확인" 화면이라면 이곳은 "구성 관리" 화면이다.

목적:

- 매달 빠지는 돈을 한눈에 확인
- 가용 예산 = 월 수입 − **활성** 항목 합계 (해제된 항목은 빠짐) 계산의 정확도 확보

화면 구성 (위에서 아래):

1. **합계 카드** — "매달 빠지는 돈" + 큰 금액 + "총 N개 항목 · 가용 예산 계산에 반영돼요" (§3 핵심 숫자)
2. **사용 중 섹션** — 활성 항목 카드 리스트. 항목 탭 시 액션 Sheet (금액 수정 / 해제 / 삭제)
3. **카탈로그 그룹 섹션** — AI / OTT / 음악 / 생산성 / 클라우드 순서로 그룹별 둥근 pill 버튼 그리드. 사용자는 본인이 쓰는 항목을 눌러 활성화한다
4. **직접 추가 버튼** — 카탈로그에 없는 항목(월세, 통신비 등)을 입력하는 진입점

카탈로그 버튼 상태:

- 비활성 (회색 border + bg-card): 서비스명 + 플랜명 + 기본 금액 표시. 탭 시 금액 확인 Sheet 오픈 → 사용자가 금액 확인/수정 후 "사용 중으로 추가하기"
- 활성 (primary border + primary/10 배경 + 체크 아이콘): 시각적으로 명확히 구분. 다시 탭하면 활성 항목 액션 Sheet (수정 / 해제 / 삭제)

데이터 모델:

- `subscription_plans` 카탈로그 (공유 시드, `default_amount` 컬럼은 기본값일 뿐)
- `fixed_expenses` (`subscription_plan_id` nullable FK, `is_active` boolean)
- 활성 항목만 budget 계산에 반영
- 해제(`is_active = false`)는 기록을 남기는 반면, 삭제는 row를 제거한다. 카탈로그 출신은 해제를 우선 제안, 직접 추가 항목은 삭제도 제공한다.

진입점:

- 하단 탭의 "고정지출" (§11.2)
- 설정 화면의 "월 고정지출" 카드 (합계 + 화살표)

### 12.6 Calendar (Dashboard 임베드)

소비 캘린더는 대시보드의 핵심 정보와 함께 한 화면에서 노출된다. 별도 라우트로 분리하지 않는다.

캘린더는 다음만 표시한다.

- 월 이동 버튼 (대시보드 헤더 아래의 MonthSwitcher와 공유)
- 날짜별 총 소비 금액
- 오늘 / 선택 셀 강조

수입은 표시하지 않는다. 셀 표시 규칙은 §14를 따른다.

날짜 클릭 시 대시보드 하단 "DayTransactions" 섹션이 그 날짜의 거래로 갱신된다 (Sheet가 아님). 거래 항목을 누르면 기존 소비 수정 dialog를 연다.

`calendar` 모드에서는 7×6 고정 그리드(다른 달 일부 회색)로 한 달 전체를 보여준다. `income_day` 모드(§12.5a)에서는 사이클 첫날부터 끝날까지만 렌더하는 **가변 그리드**를 사용한다. 첫 행 들여쓰기는 사이클 시작일의 요일에 따라, 마지막 행 패딩은 사이클 끝일 요일에 따라 결정되며, 행 수는 4~6 가변이다. MonthSwitcher의 이전/다음 버튼은 항상 사이클 단위로 이동하며 라벨은 모드에 따라 "5월" 또는 "5/20 – 6/19" 형식이다.

### 12.8 Friends

티끌은 친구의 이번 달 또는 사이클 소비 흐름을 함께 들여다볼 수 있는 가벼운 공유 기능을 제공한다. 가계부 공유나 정산 도구가 아니다. owner가 친구별로 노출 항목을 선택적으로 켜고 끌 수 있으며, 어떤 조합에서도 `monthly_income` / 가용 예산 / 소비율은 절대 공유하지 않는다.

#### 12.8.1 목적과 원칙

- 노출 가능 항목은 4가지다 — **총 소비 금액**, **소비 내역(캘린더+거래 리스트)**, **고정지출 합계**, **고정지출 항목**. owner가 friend별로 4개 토글을 독립적으로 켜고 끌 수 있다.
- 친구의 `monthly_income` / 가용 예산 / 소비율 / progress bar는 어떤 토글 조합에서도 노출하지 않는다 (§19). 이를 노출하는 RPC도 존재하지 않는다.
- 페어링은 **양방향 자동**이다. 한쪽이 코드를 발급하고 다른 한쪽이 입력하면 양방향 friendship row가 한 번에 만들어진다. 한쪽이 해제하면 양쪽 모두 즉시 끊긴다. 노출 토글은 **방향별 독립** — 내가 친구에게 보여주는 항목과 친구가 나에게 보여주는 항목은 별개 row의 별개 컬럼이다.
- 기존 친구 관계의 기본값은 backward-compatible — 총 소비/소비 내역은 ON, 고정지출 합계/항목은 OFF.
- 친구 데이터도 본인 데이터와 동일하게 캐시 금지다 (§16.2, §19).

#### 12.8.2 데이터 모델

세 테이블을 사용한다.

- `friend_codes` — 6자 코드(혼동 글자 `0/O/1/I` 제외 32자 알파벳), 10분 TTL, 단일 사용. 동일 owner가 새 코드를 발급하면 기존 활성 코드는 즉시 만료 처리한다.
- `friendships` — 양방향 두 row(`owner_id`, `viewer_id`). `owner_id ≠ viewer_id` 제약과 `(owner_id, viewer_id)` UNIQUE. 가시성 컬럼 4개(`show_spending_total`, `show_spending_items`, `show_fixed_total`, `show_fixed_items`, 모두 `boolean not null`)가 owner의 outbound row에 저장된다 (`0031_friend_visibility_scope.sql`).
- `redeem_attempts` — 코드 입력 rate-limit 로그. 60초 윈도우 안 5회까지 허용.

`transactions`와 `profiles`는 friendship row가 있을 때 viewer에게 SELECT가 허용된다(`0019_friendship_view_policies.sql`, `0031_friend_visibility_scope.sql`). `transactions` SELECT는 `show_spending_items=true`일 때만 허용한다. `fixed_expenses`도 동일하게 `show_fixed_items=true`일 때만 허용한다(`0031`). `profiles`는 닉네임 표시용이라 토글에 영향받지 않는다. `user_settings`는 RLS로 친구에게 직접 노출하지 않는다 — 사이클은 아래 RPC로만 접근한다.

#### 12.8.3 RPC

모든 함수는 `SECURITY DEFINER`로 정의하며 `authenticated` 역할에만 grant한다. SECURITY DEFINER가 RLS를 우회하므로 본문 안에서 friendship + 토글을 직접 체크한다.

- `redeem_friend_code(p_code text) returns text` — 호출자가 viewer가 된다. `for update`로 코드 row를 잠가 동시 redemption을 막은 뒤 `friendships` 양방향 row를 `on conflict do nothing`으로 INSERT하고 코드를 사용 처리한다. 반환값은 정확히 `ok` / `invalid` / `self` / `unauthenticated` 4종이며, 어떤 케이스인지 외부에 누설하지 않기 위해 만료/존재하지 않음/이미 사용됨을 모두 `invalid`로 묶는다.
- `get_user_cycle(target uuid) returns table(cycle_mode text, cycle_start_day smallint)` — 호출자가 본인이거나, `target = owner_id ∧ caller = viewer_id`인 friendship row가 있을 때만 한 줄을 반환한다. `monthly_income`은 시그니처에 포함되지 않으므로 RPC 자체가 노출 차단의 마지막 방어선 역할을 한다.
- `get_friend_spending_total(target uuid, start_iso timestamptz, end_iso timestamptz) returns numeric` — 합계만 노출하는 경로용. friendship + `(show_spending_total OR show_spending_items)`을 체크하고, `deleted_at IS NULL` 행만 합산한다. **항목 토글이 꺼진 케이스에서 viewer가 row를 직접 SELECT 할 수 없도록 row 단위 RLS는 차단된 상태로 두고, 합계는 이 RPC를 통해서만 얻는다.**
- `get_friend_fixed_total(target uuid) returns numeric` — 위와 동일한 패턴으로 고정지출 합계를 반환한다. `is_active = true` 행만 합산하고 `(show_fixed_total OR show_fixed_items)`을 체크한다.

#### 12.8.4 화면 — `/friends`

페이지 구조:

```txt
PageHeader
  eyebrow: ◀ 설정
  title:   친구

FriendCodeIssueCard      ← 활성 코드 1개 / 만료 카운트다운 / 복사 / 새로 발급
FriendCodeRedeemForm     ← 6자 코드 입력
FriendList               ← 친구 N명 목록 + 톱니(보여줄 항목) + 해제 휴지통
```

규칙:

- `<AppShell>`에 `withBottomNav`를 넘기지 않는다. 친구 페이지는 부모 화면이 아니라 설정에서 들어오는 보조 화면이다.
- 코드 발급 카드는 동시에 활성 코드를 **1개만** 유지한다. 새로 발급 버튼은 이전 코드를 만료시키고 새 코드를 만든다.
- 입력 폼은 자동으로 대문자화하고 `[^A-Z0-9]`를 제거하며 6자에서 잘린다. rate-limit 초과 시에는 일반화된 안내 카피만 보여준다(어떤 케이스인지 누설 금지).
- 친구 해제 confirm 본문은 "서로의 티끌을 더 이상 볼 수 없게 돼요." 한 문장.
- 친구 row의 톱니 아이콘 → `DrawerContent` 기반 가시성 시트. 4개 `Switch` 행(`총 소비 금액 / 소비 내역 / 고정지출 합계 / 고정지출 항목`), 각 토글은 optimistic update로 즉시 반영되고 실패 시 sonner 토스트와 함께 이전 상태로 되돌린다. 마지막 토글(`고정지출 항목`) 아래 보조 카피로 "항목 이름이 친구에게 그대로 보여요."를 두어 owner가 직접 입력한 항목명("부모님 휴대폰비" 등)이 노출됨을 결정 시점에 환기한다.
- 친구 목록 쿼리는 **outbound 방향**(`owner_id = me`) 한 번에 가시성 컬럼까지 같이 가져온다. auto-mutual 페어링 덕분에 viewer 방향 쿼리와 결과 친구 집합은 동일하다.

#### 12.8.5 친구 모드 (대시보드)

URL은 `/dashboard?viewing=<friendId>`. 친구 모드 진입 검증은 두 단계다.

1. `viewing` 값이 UUID 정규식을 통과하는지.
2. 호출자가 viewer로 페어링된 friendship row가 존재하는지.

둘 중 하나라도 실패하면 본인 모드로 폴백한다.

친구 모드에서의 화면 동작:

- `<AppShell withBottomNav={false} withFab={false}>` — 하단 탭과 추가 FAB 모두 숨긴다. 친구 화면에서 거래를 추가할 수 없다.
- 합계 카드 위에 친구 모드 배너 한 줄: `"{닉네임}님의 티끌을 보고 있어요"` 와 우측 "내 티끌로" 링크. **배너는 모든 토글이 꺼져 있어도 항상 렌더한다** — owner가 토글을 다시 켰을 때 transactions 리얼타임이 `router.refresh()`를 트리거해야 다시 데이터가 뜬다.
- 친구 모드 대시보드는 **4개의 독립 블럭**으로 구성되며 각 블럭은 대응하는 토글이 ON일 때만 렌더한다. 4개 모두 OFF면 페이지 단위 fallback 카드 `"친구가 모든 항목을 비공개로 설정했어요."`만 띄운다.
  - 블럭 1: 총 소비 카드. `friendView` 분기 사용 — 총 소비 금액 헤로 숫자만 노출하고 **가용 예산·소비율·progress bar·고정지출/수입 보조 카피는 일절 표시하지 않는다**.
  - 블럭 2: 캘린더 + 일별 거래 리스트. 거래 row는 클릭 비활성(`readOnly={true}`).
  - 블럭 3: 친구의 고정지출 합계 카드. "친구의 고정지출 합계" 라벨 + 합계 헤로. owner-context 푸터("가용 예산 계산에 반영돼요")는 친구 모드에서 의미가 없으므로 제외한다.
  - 블럭 4: 고정지출 항목 리스트. 카탈로그 그리드/검색/필터/추가 컨트롤은 보여주지 않는다(클릭 불가, read-only).
- 합계만 노출하는 경로(`show_*_total=true ∧ show_*_items=false`)에서는 행 단위 RLS가 차단되어 있으므로 `get_friend_spending_total` / `get_friend_fixed_total` RPC로만 합계를 가져온다. 항목 토글이 켜진 경로에서는 RLS가 허용된 SELECT로 행을 받아 합계는 클라이언트에서 계산한다.
- 헤더 trailing의 `<FriendSwitcher>`는 본인 "(나)" + 친구 목록을 시트로 보여주며, 친구가 0명이면 `/friends`로 안내하는 한 줄을 노출한다.
- `<FriendRealtimeWatcher friendUserId={...}>`가 친구 모드에서만 마운트된다 (§12.8.6).

#### 12.8.6 Realtime 인프라

- `transactions` 테이블만 `supabase_realtime` publication에 등록되어 있다. `fixed_expenses`는 변경 빈도가 낮아 publication에 추가하지 않는다 — owner가 가시성 토글을 바꾸거나 고정지출을 편집한 직후 친구 화면이 stale할 수 있지만, transactions 리얼타임이 발생하거나 다음 네비게이션 시 `router.refresh()`가 모든 섹션을 재실행해 보정된다.
- `replica identity full`로 설정해 UPDATE/DELETE 이벤트가 old row 전체를 실어 보내므로 client-side 필터(`user_id=eq.<friendId>`)가 soft delete와 hard delete 모두에서 안정적으로 동작한다.
- Watcher는 채널 `friend-tx:<friendId>`에 `postgres_changes`(`event: "*"`)를 구독한다.
- 변경 이벤트는 **300 ms 디바운스** 후 `router.refresh()`를 호출한다 — 짧은 시간 안에 여러 변경이 와도 한 번만 새로고침한다.
- 본인 모드에서는 watcher를 마운트하지 않는다.
- `friendships` 테이블 자체의 리얼타임 watcher는 추가하지 않는다. owner가 토글을 OFF로 바꾼 직후 viewer의 현재 페이지는 시각적으로 stale일 수 있지만, RLS와 RPC perm 체크가 다음 fetch 시점에 데이터를 차단하므로 보안은 깨지지 않는다.
- Realtime payload는 어디에도 캐시하지 않는다 (§16.2, §19).

#### 12.8.7 닉네임

- `profiles.display_name`을 사용한다. 가입 트리거가 한국어 형용사 + 명사 + 4자리 숫자 조합으로 자동 시드한다.
- Settings에서 편집 가능 (최대 20자, 공백/탭/줄바꿈 금지).
- 표시 규칙:
  - 본인은 `FriendSwitcher`에서 `"{닉네임} (나)"` 라벨로 표시한다.
  - 친구 닉네임이 빈 값이면 친구 화면에서 "이름 없음"으로 폴백한다.

#### 12.8.8 DM (Direct Messages)

거래에 직접 붙던 반응(`transaction_reactions`)과 댓글(`transaction_comments`)은 **`0037_pivot_to_dm.sql`** 에서 모두 폐기되었다. 친구와의 모든 인터랙션은 친구 쌍 단위의 1:1 DM 스레드(`dm_messages`)로 모이며, "잔소리 on this spending" 같은 거래 컨텍스트는 메시지가 `quoted_transaction_id`로 거래를 인용하는 방식으로 보존된다.

**데이터 모델**

- `dm_threads(id, user_a_id, user_b_id, created_at)` — 친구 쌍당 1개. `user_a_id < user_b_id` CHECK + `(user_a_id, user_b_id)` UNIQUE로 canonical 순서가 강제된다. 그래서 한 쌍에 대해 `(A, B)`와 `(B, A)`가 동시에 존재하지 않는다.
- `dm_messages(id, thread_id, sender_id, content[1-500], quoted_transaction_id?, created_at)` — 스레드 안의 정렬된 메시지. `quoted_transaction_id`는 FK이지만 `ON DELETE` 없이 — 거래는 soft delete(`deleted_at`)만 쓰므로 FK가 실 production에서 깨지지 않으며, 만약 hard delete가 시도되면 Postgres가 차단한다 ("hard preserve" 정책).
- 스레드 생성은 SECURITY DEFINER RPC `get_or_create_dm_thread(target uuid)`만이 가능. RPC는 friendship 존재 + canonical 정렬 + `INSERT ... ON CONFLICT DO NOTHING` 으로 race를 흡수한다.

**RLS**

- `dm_threads` SELECT: 멤버(`user_a_id`, `user_b_id`)만. INSERT: 멤버 + friendship 존재.
- `dm_messages` SELECT: thread 멤버. INSERT: `sender_id = auth.uid()` + thread 멤버 + (인용이 있으면) `quoted_transaction_id`가 sender가 SELECT 가능한 live 거래를 가리킴 — 거래 자체의 friendship + `show_spending_items` 게이트와 동일 predicate를 다시 적용한다.
- DELETE: sender 본인만. UPDATE 정책은 의도적으로 없다 — 수정 대신 delete-and-repost.
- Friendship 해제 후에도 thread row와 메시지는 보존된다 (정책 결정 5a). SELECT 정책에서 friendship을 재확인하지 않으므로 양쪽 모두 과거 메시지를 계속 볼 수 있다.

**친구 거래 sheet → DM**

친구 거래 row 탭 → `<TransactionInteractionSheet>` 가 열린다. 친구 모드에서는 두 가지 액션만:

1. **빠른 반응 — 큐레이트된 이모지(`👍 ❤️ 😂 😮 😢 🔥`) 한 번 탭**: `sendReactionMessageAction(txId, emoji)` 가 `get_or_create_dm_thread` RPC로 스레드를 확보한 뒤 `dm_messages` 에 `(content=emoji, quoted_transaction_id=txId)` 한 줄을 인서트한다. 직전 메시지가 같은 sender + 같은 emoji + 같은 거래 인용이면 **서버 단계 debounce 로 인서트를 스킵**한다 — 토글 개념 없이 의도된 1회 반응만 보내지게 한다 (정책 결정 1b).
2. **답장 버튼**: `/dm/<ownerUserId>?quote=<txId>` 로 이동. DM 페이지가 `quote` 쿼리 파람을 읽어 composer에 인용 카드를 미리 붙여둔다.

거래 row 자체에는 인라인 반응 카운트나 댓글 프리뷰가 더 이상 없다 — 모든 인터랙션이 DM에 있으므로 owner도 DM 스레드에 가서 누가 무엇을 보냈는지 확인한다 (정책 결정 2).

**자기 거래**

본인 거래 sheet는 (a) 수정 form 한 가지만 노출한다. 본인 거래에 본인이 반응하는 경로는 막혀 있다 (`sendReactionMessageAction` 이 owner=caller 케이스를 거절).

**DM 페이지 — `/dm/[friendId]`**

- 친구별 1:1 채팅 surface. 헤더: 친구 닉네임 + "◀ 친구" 백 링크.
- 페이지 진입 시: friendship 검증 → `get_or_create_dm_thread` → 메시지 200개 fetch(오름차순) → 인용된 거래 일괄 fetch (soft-delete 포함, "삭제된 소비" stub 렌더용).
- 메시지 리스트: 자기 메시지는 우측 primary 컬러, 친구 메시지는 좌측 muted. 이모지-단독(공백 없고 8자 이하) 메시지는 `text-[24px]` 청크형 버블로 — 거래 sheet 반응이 그대로 메시지가 되어도 시각적으로 "반응"으로 읽힌다.
- composer: textarea + 전송 버튼. 인용 카드는 메시지 위에 stack 되어 표시되고 X로 제거 가능. composer는 페이지 하단 `fixed`이며 `safe-area-inset-bottom` 을 패딩에 반영한다.
- realtime: `dm-thread:<threadId>` 채널이 `postgres_changes` (event=`*`, `thread_id=eq.<id>`) 를 구독, 300ms 디바운스 후 `router.refresh()`. RLS가 비멤버 이벤트를 자동 차단한다.

**친구 omnibox 시트의 DM 진입점**

`<FriendOmniboxSheet>` 의 각 친구 row 우측에 메시지 아이콘 버튼이 있다. 탭 → `router.push(/dm/<friendId>)`. 친구 가시성 설정 버튼(톱니)과는 별도 affordance.

**Realtime 인프라**

`dm_messages` 만 `supabase_realtime` publication에 등록되어 있고 `replica identity full` 이다. `dm_threads` 는 INSERT-only이고 변경 빈도가 거의 없어 publication에 추가하지 않는다.

**알림**

`user_settings.transaction_interaction_notifications` 컬럼(0035)은 폐기되지 않고 의미만 확장된다: "내 거래에 반응(=DM 메시지)이 들어오거나, 내 앞으로 DM 메시지가 도착할 때 푸시 알림 받기". push edge function의 분기는 별도 작업 대상이다.

---

## 13. Transaction Components

### 13.1 Transaction Item

```txt
[icon] 식비
       동네 백반                          12,000원
```

메모가 있는 경우 카테고리명 바로 아래에 한 줄로 표시한다. 길이가 넘치면 truncate한다.

- 카테고리명: `text-[15px] font-medium`, foreground
- 메모: `text-[12px] text-muted-foreground`, 메모가 없는 행에서는 렌더하지 않는다 (한 줄짜리 그대로 유지)

아이콘 컨테이너:

```tsx
<div className="flex size-11 items-center justify-center rounded-full bg-muted text-foreground">
  {icon}
</div>
```

금액 색상:

- 기본 소비: foreground
- 예산 초과 자체는 개별 item이 아니라 summary에서 표현

---

## 14. Calendar Guidelines

캘린더는 대시보드 내부 컴포넌트로 임베드된다. 별도 라우트나 진입 버튼은 없다.

원칙:

- 달력은 합계 카드 아래에서 일별 흐름을 보여주는 보조 영역이다.
- 합계 카드보다 시각적으로 가벼워야 한다.
- 날짜별 총 소비 금액만 표시한다.
- 수입 금액은 표시하지 않는다.
- 소비 없는 날짜는 비워둔다.
- 큰 소비가 있는 날짜만 약하게 강조한다. 임계값은 가용 예산을 30으로 나눈 일평균 기준 — 2배 이상 warning, 3배 이상 danger. 사이클 길이가 28~31일로 가변이어도 분모는 30으로 고정한다 (skew 무시 가능 범위).

날짜 셀 예시:

```txt
18
391,800
```

날짜 셀 규칙:

```txt
기본 날짜: muted foreground
소비 있음: foreground
큰 소비: danger 또는 warning
오늘: primary ring
선택됨: primary background
```

---

## 15. Forms

Forms는 직접적이고 관대해야 한다.

규칙:

- 필드 수를 최소화한다.
- 기본값을 제공한다.
- 금액 입력은 numeric keyboard를 사용한다.
- 날짜 기본값은 오늘이다.
- 저장 버튼은 쉽게 닿는 위치에 둔다.
- 기술적인 에러 메시지를 그대로 보여주지 않는다.

금액 입력 규칙:

- 입력 중 쉼표 formatting을 지원한다.
- submit 시 number로 정규화한다.
- 0원 이하 저장을 막는다.
- 너무 공격적으로 입력을 막지 않는다.

---

## 16. PWA

티끌은 모바일 홈 화면에 설치 가능한 PWA로 동작한다. 오프라인 동작은 지원하지 않으며, Service Worker는 앱 shell 정도만 캐싱한다.

### 16.1 Install Target

- 앱 이름과 짧은 이름: 티끌
- standalone display mode
- iOS/Android 모바일 브라우저에서 "홈 화면에 추가" 가능
- 192x192, 512x512 아이콘 + Apple Touch Icon

### 16.2 Cache Rule

Service Worker는 다음만 캐싱한다.

- HTML/CSS/JS 정적 리소스
- 앱 shell, manifest, 아이콘

다음은 모두 `NetworkOnly`로 강제하며, 절대 캐싱하지 않는다.

- 개인 소비 데이터
- `*.supabase.co` 호스트로 향하는 모든 요청
- Supabase 인증 요청 (`/auth/v1/*`)
- Supabase REST 요청 (`/rest/v1/*`)
- Supabase 스토리지 요청 (`/storage/v1/*`)
- Supabase Realtime 요청 (`/realtime/v1/*`)
- 친구의 거래 / 프로필 / Realtime payload (본인 데이터와 동일하게 캐시 금지)

네트워크가 끊기면 앱은 정상 동작하지 않는다. 별도의 오프라인 fallback 페이지나 동기화 큐는 제공하지 않는다.

---

## 17. Accessibility

필수 규칙:

- 최소 터치 영역은 44px 이상
- 색상만으로 상태를 표현하지 않는다
- icon-only button에는 aria-label을 제공한다
- focus state를 숨기지 않는다
- reduced motion을 지원한다
- semantic HTML을 사용한다

예시:

```tsx
<Button aria-label="소비 추가" size="icon">
  <PlusIcon />
</Button>
```

---

## 18. Iconography

아이콘은 lucide-react를 우선 사용한다.

규칙:

- 기본 크기: 20px
- 주요 액션 아이콘: 24px
- stroke width: 2px
- outline 스타일 중심
- 아이콘은 텍스트를 대체하지 말고 보조해야 한다

---

## 19. Do's and Don'ts

### Do

- 홈 화면을 핵심 숫자 중심으로 유지한다.
- 소비 추가를 FAB로 빠르게 접근하게 한다.
- 소비 추가와 소비 수정을 같은 form으로 처리한다.
- 소비 삭제는 수정 form 안의 destructive 버튼 + AlertDialog 확인으로만 노출한다 (swipe / long-press / 별도 메뉴 금지).
- 월 수입, 고정지출, 가용 예산, 소비율의 관계를 명확히 보여준다.
- 대시보드와 고정지출 사이는 하단 2탭으로 이동한다 (§11.2).
- 활성 고정지출 합계만 가용 예산 계산에 반영한다 (해제된 항목은 빠짐).
- Pretendard를 기본 폰트로 사용한다.
- 모바일에서 먼저 좋은 화면을 만든다.

### Don't

- 홈 화면에 차트와 통계를 과하게 넣지 않는다.
- 하단 탭에 3개 이상의 항목을 넣지 않는다 (이번 달 / 고정지출 두 개만).
- MVP에서 Recharts를 사용하지 않는다.
- 수입 내역을 transaction처럼 입력하게 만들지 않는다.
- merchant, payment method 같은 필드를 넣지 않는다. 메모(선택, 100자)만 허용한다.
- private spending data를 Cache Storage에 저장하지 않는다.
- 친구의 transactions / profile / fixed_expenses / Realtime payload를 Cache Storage에 저장하지 않는다 — 친구 데이터도 NetworkOnly다.
- 친구 화면에 monthly_income / 가용 예산 / 소비율 / progress bar를 노출하지 않는다 — 가시성 토글이 어떻게 조합돼 있든 이 값들은 절대 보여주지 않는다. 사이클은 `get_user_cycle` RPC, 합계는 `get_friend_spending_total` / `get_friend_fixed_total` RPC로만 가져온다 (§12.8.3, §12.8.5).
- 합계 토글만 켜져 있는 경우 row 단위 SELECT를 노출하지 않는다 — RLS는 `items` 토글로만 게이트하고 합계는 SECURITY DEFINER RPC를 통해서만 얻는다 (§12.8.3).
- 친구의 친구에게 작성자 신상을 노출하지 않는다 — 모든 인터랙션(반응·답장)은 친구 쌍 단위 1:1 DM(`dm_messages`)으로 흐른다. 거래에 직접 반응이나 댓글을 매다는 surface(예전 `transaction_reactions` / `transaction_comments`)는 폐기되었으며 재도입하지 않는다 (§12.8.8).
- 거래 row UI에 반응 카운트 / 댓글 프리뷰를 노출하지 않는다 — 모든 인터랙션은 DM 스레드에서 확인한다. 거래 row는 카테고리 + 금액 + 메모만 표시한다 (§12.8.8).
- Apple 브랜드나 고유 UI(글래스모피즘 탭 스위처 등)를 복제하지 않는다.
- 카드 안에 카드를 중첩하지 않는다 — surface는 한 단계까지.
- 소비 삭제를 hard delete로 처리하지 않는다 — `transactions.deleted_at` 컬럼을 사용한 soft delete만 사용한다.

---

## 20. Implementation Notes for AI Coding Agents

UI 코드를 생성할 때 다음을 지켜라.

1. shadcn/ui를 기본 컴포넌트로 사용한다.
2. Tailwind CSS utility class로 최종 시각 조정을 한다.
3. Pretendard를 기본 sans font로 사용한다.
4. mobile-first layout을 기본으로 한다.
5. 홈 화면은 핵심 숫자와 progress bar 중심으로 만든다.
6. 소비 추가는 Floating Action Button으로 시작한다.
7. 소비 추가와 소비 수정은 같은 dialog 또는 sheet form을 재사용한다.
8. 입력 필드는 카테고리, 금액, 날짜, 메모(선택)만 사용한다.
9. MVP에서는 Recharts를 사용하지 않는다.
10. MVP에서는 Bottom Navigation을 만들지 않는다.
11. UI 컴포넌트와 데이터 로직을 분리한다.

---

## 21. Example Screen Composition

### Dashboard

```tsx
<AppShell withBottomNav={isOwn} withFab={isOwn}>
  <PageHeader
    eyebrow="{월라벨} 소비를 가볍게 확인해요"
    title="티끌"
    trailing={
      <>
        <FriendSwitcher /> {/* 본인/친구 전환 시트 */}
        <SettingsLink />
      </>
    }
  />
  {!isOwn && <FriendModeBanner nickname={viewingNickname} />}
  {!isOwn && <FriendRealtimeWatcher friendUserId={viewingUserId} />}
  <MonthSwitcher ym={ym} />
  <MonthlySummaryCard friendView={!isOwn} />
  <SpendingProgress hidden={!isOwn} />
  <SpendingMonthGrid ym={ym} selectedDay={day} dailyTotals={…} />
  <DayTransactionList day={day} />
  <AddTransactionButton defaultDate={day} />
</AppShell>
```

### Add Transaction

```tsx
<TransactionFormDialog mode="create">
  <CategorySelect />
  <AmountInput />
  <MemoInput />
  <DatePicker />
  <SubmitButton>추가하기</SubmitButton>
</TransactionFormDialog>
```

### Edit Transaction

```tsx
<TransactionFormDialog mode="edit" transaction={transaction}>
  <CategorySelect />
  <AmountInput />
  <MemoInput />
  <DatePicker />
  <SubmitButton>수정하기</SubmitButton>
</TransactionFormDialog>
```

### Settings

```tsx
<AppShell>
  <PageHeader title="설정" />
  <SettingsForm fields={["monthlyIncome", "fixedExpense"]} />
  <LogoutButton />
</AppShell>
```

---

## 22. Final Visual Target

완성된 티끌은 다음 느낌이어야 한다.

```txt
아이폰 홈 화면에서 바로 열 수 있는 조용한 개인 소비 확인 앱.
앱을 열면 선택한 월의 소비, 소비율, 일별 흐름이 즉시 보인다.
다른 날짜를 누르면 그 날의 거래가 바로 아래에 펼쳐진다.
소비 추가는 몇 초 안에 끝난다.
화면은 복잡하지 않고, 숫자는 선명하며, 행동은 명확하다.
```
