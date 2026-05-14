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
/dashboard       현재 소비 상태 확인 (결과)
/fixed-expenses  매달 빠지는 돈 구성 관리 (구성)
/settings        월 수입 설정 / 로그아웃 (보조)
/calendar        날짜별 소비 흐름 확인, MVP 1.5
/login           로그인
/signup          회원가입
```

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

- 오른쪽 아래 소비 추가 FAB (탭 위로 떠 있음)
- 우상단 설정 아이콘
- 캘린더는 별도 라우트가 아니라 대시보드에 임베드된다 (§12.1, §14 참조).

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

- 월 수입
- 예산 주기 (§12.5a)
- 월 고정지출 — 합계 표시 + `/fixed-expenses`로 진입하는 링크 카드
- 로그아웃

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

친구 대시보드는 친구 본인의 사이클을 그대로 사용한다. 친구의 `monthly_income`은 노출하지 않으며, 사이클 정보(`cycle_mode`, `cycle_start_day`)만 `get_user_cycle` RPC로 가져온다. RPC는 friendship 관계가 있는 viewer에게만 row를 반환한다.

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

다음은 캐싱하지 않는다.

- 개인 소비 데이터
- Supabase 인증 요청 (`/auth/v1/*`)
- Supabase REST 요청 (`/rest/v1/*`)

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
<AppShell withBottomNav>
  <PageHeader
    eyebrow="{월라벨} 소비를 가볍게 확인해요"
    title="티끌"
    trailing={<SettingsLink />}
  />
  <MonthSwitcher ym={ym} />
  <MonthlySummaryCard />
  <SpendingProgress />
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
