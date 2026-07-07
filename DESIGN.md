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

홈 화면에서 가장 먼저 보여야 하는 것은 이번 사이클 "쓴 돈"이다. 카드 최상단에 작은 설명 라벨("이번 주기 쓴 돈" / 파생 calendar 모드는 "이번 달 쓴 돈")을 두고, 그 아래 가장 큰 단일 hero 숫자(38px extrabold) **하나**로 총액을 박는다. 이 라벨은 숫자가 무엇인지 알려주는 설명일 뿐 사이클 eyebrow가 아니다 — 사이클 맥락은 여전히 MonthSwitcher 라벨(`5월` / `5/20 – 6/19`)이 전담한다. "남은 돈"은 hero 숫자 옆이 아니라 **예산 바 아래 점선 구분선(인셋, 앱 기본 `border-dashed border-border`) 다음의 2분할 행**으로 내려가, "하루 쓸 수 있는 돈"과 나란히 보조 숫자(19px)로 따라붙는다.

그다음은 월 수입 대비 사용률이다. 사용률의 분자는 고정지출과 변동소비의 합이며, 분모는 월 수입이다. "내 돈 중 얼마가 나갔는가"라는 직관에 맞춘다.

```txt
이번 주기 쓴 돈                    ↘ 51만원 덜 씀
2,089,950원
[38px extrabold]

[█████░░░░░░░░░]        61% · 주의
● 고정 1,445,610   ● 소비 644,340
   - - - - - - - - - - - - - - - -
남은 돈        │ 하루 쓸 수 있는 돈 · 12일
1,328,040원    │ 110,670원  [primary]
```

대시보드 `PageHeader`의 title은 모드 무관하게 브랜드명 "티끌"로 고정한다. 사이클 정보는 합계 카드 아래 MonthSwitcher 라벨(`5월` 또는 `5/20 – 6/19`)이 전담한다. 사용자가 설정에서 돈 들어오는 날을 달 중간(2~28일)으로 고르거나 급여 규정 보정으로 주기 경계가 달력 월에서 벗어나면(§12.5a, 파생 `income_day` 모드) MonthSwitcher 라벨과 캘린더 그리드가 사이클 기준으로 바뀐다. 합계 카드의 "총 소비 / N원"이 핵심 숫자 자리를 유지한다.

### 3.2 기능보다 명료함 우선

MVP에서는 다음 기능을 과하게 강조하지 않는다.

- 복잡한 분석
- 통계 차트
- 카테고리별 Top 5
- 수입 내역 관리
- 전체 거래 내역 페이지

단, 「이번 사이클 소비 구성」 전용 통계 화면(`/stats`, §12.9)은 예외로 둔다 — 홈(대시보드)에는 여전히 넣지 않고, 차트가 아니라 카테고리/항목 분해 리스트(아이콘 + CSS 막대)로만 표현한다. 위 목록은 "홈 화면에 욱여넣지 않는다"는 뜻이지 별도 화면 자체를 금지하는 것이 아니다.

### 3.3 한 화면에 하나의 목적

각 화면의 목적은 명확해야 한다.

```txt
/dashboard       현재 소비 상태 확인 (결과). 친구 모드는 ?viewing=<friendId> 쿼리
/stats           이번 사이클 소비 구성 분해 (분석, own 전용) (§12.9)
/savings         매달 모으는 돈(적금·투자·목표) 관리 (모으기) (§12.10)
/fixed-expenses  매달 빠지는 돈 구성 관리 (구성)
/friends         친구 코드 발급/입력, 친구 목록 (§12.8)
/settings        월 수입·예산 주기·닉네임·로그아웃 (보조)
/login           로그인
/signup          회원가입
```

캘린더는 별도 라우트가 아니라 대시보드에 임베드된다 (§12.6).

### 3.4 빠른 소비 입력

소비 추가는 화면 오른쪽 아래 Floating Action Button으로 시작한다.

소비 입력 필드는 다음 4개를 핵심으로 한다.

- 카테고리
- 금액
- 날짜
- 결제수단 (신용카드 / 체크카드, 필수)

여기에 짧은 식별을 위한 선택 필드 1개가 더해진다.

- 메모 (선택, 최대 100자)

결제수단은 신용/체크 소비 비율(§12.9)과 향후 신용카드 할부를 위해 둔다. merchant
(가맹점)는 여전히 두지 않는다 — 결제수단만 예외다.

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

하단 탭 네비게이션은 다음 3탭만 사용한다 (§11.2 참조).

- 소비 → `/dashboard`
- 돈모으기 → `/savings`
- 고정지출 → `/fixed-expenses`

설정·통계·친구는 하단 탭에 넣지 않는다 — 설정은 대시보드 우상단 설정 아이콘, 통계(§12.9)·친구(§12.8)는 각자의 진입점으로 들어간다.

대시보드와 돈모으기에는 추가 Floating Action Button을 화면 오른쪽 아래에 고정한다. FAB은 하단 탭 위로 떠 있게 배치한다.

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

### 11.2 Bottom Tab Navigation (3탭)

소비·돈모으기·고정지출은 동급의 메인 화면이다. 셋 사이를 빠르게 오갈 수 있도록 화면 하단에 3탭 네비게이션을 둔다. 돈모으기는 "다시 내 자산이 되는 돈"(적금·투자·목표)을, 고정지출은 "쓰고 사라지는 돈"을 다룬다 — 둘은 의미가 달라 분리한다(§12.10).

```txt
[ 소비 ]      [ 돈모으기 ]   [ 고정지출 ]
 /dashboard    /savings       /fixed-expenses
```

원칙:

- 탭은 항상 3개다 (소비 / 돈모으기 / 고정지출). 설정·통계·친구는 탭에 넣지 않는다 — 4번째 탭을 추가하지 않는다.
- 설정은 대시보드 우상단 아이콘으로 진입한다.
- 활성 탭은 아이콘에 primary 색을 적용하고 라벨은 foreground로, 비활성 탭은 muted-foreground로 표시한다. 돈모으기 탭 아이콘은 새싹(`Sprout`)이다.
- 컨테이너 너비는 max-w-md 단일 컬럼과 정렬해야 한다.
- safe-area-inset-bottom을 고려한 padding을 둔다.
- 하단 탭이 있는 화면(`/dashboard`, `/savings`, `/fixed-expenses`)은 AppShell에 `withBottomNav` prop을 넘긴다. `/settings`는 넘기지 않는다 (탭 노출 X). own 모드 `/dashboard`와 `/savings`는 `withFab`도 함께 넘긴다.

대시보드 추가 진입점:

- 오른쪽 아래 소비 추가 FAB (탭 위로 떠 있음, 친구 모드에서는 숨김)
- 우상단 헤더 trailing — 좌측 `FriendSwitcher`(시트로 본인 ↔ 친구 전환, 친구 모드는 `?viewing=<friendId>` 쿼리), 우측 설정 아이콘
- 합계 카드 하단의 「소비 구성 보기」 CTA를 탭하면 `/stats`로 이동한다 (§12.2, §12.9). own 모드 + 현재 사이클에서만 노출하며 친구 모드에서는 진입점을 숨긴다(카드 전체 stretched-link은 제거됨).
- 캘린더는 별도 라우트가 아니라 대시보드에 임베드된다 (§12.1, §14 참조).
- 친구 모드 동작 전체는 §12.8.5 참조.

---

## 12. Screen Guidelines

### 12.1 Dashboard

Dashboard는 다음 질문에 답해야 한다.

- 선택한 달에 총 얼마를 썼는가? (고정지출 + 변동소비)
- 이번 달 수입 중 얼마를 더 쓸 수 있는가? (남은 돈)
- 수입 대비 몇 퍼센트를 썼는가?
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
- 복잡한 차트 / 미니 그래프 (추세도 막대·그래프로 그리지 않는다 — 라벨 행 우측 색칠 칩 하나만, §12.2)
- 오늘 지출 카드
- 수입 내역
- 분석 그래프
- 지난달 대비 비교 문구 — **예외: 총액 추세 칩**(§12.2). 라벨 행 우측 색칠 칩 "N만원 더/덜 씀"만 허용하고, 그 이상의 비교 카드·항목별 전월比·막대/그래프는 두지 않는다(항목별 전월比는 /stats §12.9의 일).

### 12.2 Spending Summary Card

가장 중요한 카드다. 최상단 한 행에 설명 라벨("이번 주기 쓴 돈" / calendar 모드 "이번 달 쓴 돈")과 우측 **색칠 추세 칩**을 두고, 그 아래 "쓴 돈"(= 고정 + 변동)을 **단일 hero 숫자(38px extrabold)** 하나로 박는다. 사용률 %는 월 수입 대비로 계산해 progress bar 옆 보조 라벨로 둔다. 카드 상단 eyebrow는 두지 않는다(설명 라벨은 숫자 설명일 뿐, 사이클 맥락은 MonthSwitcher 전담). 예산 바 아래 **점선 구분선(인셋, 앱 기본 `border-dashed border-border`)**으로 "남은 돈 │ 하루 쓸 수 있는 돈" 2분할 행을 분리해, "남은 돈"을 즉시 일일 행동 단위(하루 X원)로 환산해 나란히 보여준다.

**저축(돈모으기)이 이번 주기에 있으면**(active `savings_plans` 월 적립 합 > 0) 히어로가 **3분할(모으기 / 고정 / 소비)**로 바뀐다 — 큰 숫자가 「쓴 돈」에서 **「나간 돈」(= 모으기 + 고정 + 소비)**으로, 라벨도 「이번 {주기/달} 나간 돈」으로 전환된다. 저축은 **「쓴 돈」·사용률에서 제외**(자산이 되는 돈이라 소비율·주의 badge를 올리지 않음)하되 **「남은 돈」에서는 차감**한다(이번 주기에 쓸 수 있는 현금이 실제로 줄어든 것은 맞으므로). 예산 바는 녹색 모으기 세그먼트가 앞에 붙은 3분할이 되고, 범례는 모으기/고정/소비 각 행에 `%`(수입 대비)와 금액을, 마지막에 **「나간 돈 N%」**(= 바 채운 비율 = 히어로 총액) 행을 단다. 주의/위험/초과 경고는 **소비 행**에만 붙는다(사용률 = 고정+소비 기준이므로). 저축이 0이면 카드는 기존 2분할과 byte-identical이다(§12.10, `lib/utils/budget.ts`).

```txt
저축 없음(2분할):                  │  저축 있음(3분할):
이번 주기 쓴 돈        ↘ 51만원 덜 씀 │  이번 주기 나간 돈      ↘ 12만원 덜 씀
1,089,950원                        │  2,089,950원   ← 모으기+고정+소비
                                   │
[█████░░░░░░░░]   36%              │  [███░░██░░██████░]
● 고정 445,610  ● 소비 644,340      │  ● 모으기  33%  1,000,000  (녹색)
   - - - - - - - - - - - -          │  ● 고정    15%    445,610
남은 돈     │ 하루 쓸 수 있는 돈·12일 │  ● 소비    21%    644,340  · 주의?
1,910,050원 │ ... [primary]         │    - - - - - - - - - -
                                   │  나간 돈   70%  2,089,950  ← 바 채움
                                   │     - - - - - - - - - - - - -
                                   │  남은 돈      │ 하루 쓸 수 있는 돈·12일
                                   │  910,050원    │ ... [primary]
```

총액 추세 칩 (토스式, 라벨 행 우측):

- 최상단 라벨 행 **우측에 색칠 칩**으로 둔다 — "N만원 더/덜 씀"(↗/↘ 아이콘). `차이 < 5,000원`이면 칩을 숨긴다(중립 "비슷" 카피를 따로 두지 않음). 색: **덜 씀 = 초록**(text `#1c8c4d` / bg `#e8f7ee`), **더 씀 = destructive**. (이전의 "중립색 강제" 결정은 시안 합의로 폐기 — 칩이 라벨 행 우측 단독이라 옆 예산 상태색과 직접 인접하지 않아 충돌 위험이 낮다. 라이트 전용 hex.) 막대·그래프·미니그래프는 여전히 두지 않는다(§12.1/§19).
- 비교 대상은 **총액 델타**(고정 + 변동), hero "쓴 돈"(= 총액)과 같은 기준이라 숫자가 어긋나지 않는다. 변동은 "같은 경과 시점"까지 클램프, 고정은 matched-only로 비교한다(`lib/utils/stats/trend.ts`, 단위는 만원 반올림).
- own + **현재(살고 있는) 사이클** + **직전 사이클에 실거래가 있을 때만**(`hasPrevBaseline`) 노출한다 — 과거/미래 사이클엔 행동 가능한 페이스가 없고, 첫 사이클 유저에게 상설 고정지출 대비 가짜 "+전부"가 뜨는 것을 막는다(/stats §12.9와 동일 게이트). 친구 모드에서는 노출하지 않는다.

남은 돈 · 하루 쓸 수 있는 돈 (2분할):

- 예산 바 아래 점선 구분선(인셋, 앱 기본 `border-dashed border-border`) 다음에 **좌(남은 돈) · 세로 구분선 · 우(하루 쓸 수 있는 돈 · 남은 N일)** 2분할 행으로 둔다. 좌측 "남은 돈"은 항상 노출, 우측 "하루 쓸 수 있는 돈" 값은 **primary 색**으로 강조한다.
- 카피: "하루 쓸 수 있는 돈"은 모드 무관 고정 라벨이고, "· N일"(primary)은 사이클 남은 일수다. (이전의 모드별 "이번 달이 끝나기까지 / 다음 급여일까지" 페이스 카피는 제거됨 — calendar/income_day 그리드·MonthSwitcher 전환은 §12.5a대로 유지.)
- `남은 N일`은 사이클 마지막 날 − 오늘(일 단위, 자정 기준). `하루 X원 = floor(남은 돈 / 남은 일수)`.
- 우측 "하루 쓸 수 있는 돈"은 다음 중 하나라도 충족되면 값 대신 **"—"(muted)** 로 표시한다 — 행 자체는 유지해 2분할 균형을 보존한다(이전엔 페이스 줄을 통째로 숨겼다).
  - 선택된 사이클이 과거 또는 미래(지금 살고 있는 사이클이 아님).
  - `남은 일수 ≤ 0`(오늘이 사이클 마지막 날이거나 그 이후).
  - `남은 돈 ≤ 0`(이미 초과 — 하루치 환산이 의미 없음).
- 친구 모드에서는 이 2분할 행을 노출하지 않는다(남은 돈은 `monthly_income`에서 파생되므로 §19와 충돌).

계산 공식:

- `쓴 돈 = 고정지출 + 변동소비` (저축 제외 — 사용률·주의 badge를 구동)
- `나간 돈 = 저축 + 고정 + 변동` (저축 > 0일 때 히어로 숫자 = 바 채운 비율)
- `남은 돈 = 월 수입 − 나간 돈` (저축도 차감)
- `사용률 = 쓴 돈 / 월 수입 × 100` (저축은 분자에서 빠짐 — 자산이 되는 돈)

`남은 돈`이 음수일 때 라벨·색은 음수의 **원인**으로 가른다 — **실제 과소비(고정+소비 > 수입)**면 좌측 셀 라벨이 「초과」 + destructive 색, 표시 값은 절댓값. **저축 차감 때문에만 음수**(소비는 예산 내, `totalSpent ≤ 수입`)면 「초과」 빨강을 쓰지 않고 차분한 「남은 돈 -N원」 + 「저축 포함」 캡션으로 보여준다 — 자산이 되는 저축을 과소비로 오인하게 만들지 않는다(`isOverspend` vs `negativeFromSavings`, §12.10).

사용률 상태:

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

정상 구간에서는 progress bar 색과 `N%` 라벨이 시그널 전부를 담당한다. 주의/위험/초과 구간에서는 **별도 상태 카피 줄을 두지 않고** rate 라벨 자체를 "`N% · 주의`" / "`N% · 위험`" / "`N% · 초과`"로 합쳐 노출한다(이전의 "주의 구간" 한 줄 카피는 제거됨). rate **텍스트** 색은 흰 배경 대비를 위해 주의/위험에 밝은 `--warning`(#ff9500) 대신 진한 주황(`#b45309`, WCAG AA 통과)을, 초과에 destructive를 쓴다 — progress 바 **채움**색은 아래 색상 규칙(주의/위험=warning)을 그대로 유지한다.

`가용 예산 (월 수입 − 활성 고정지출)` 자체는 카드에서 직접 노출하지 않는다 — 사용자는 "남은 돈"을 통해 동일한 정보를 더 직접적으로 본다. `availableBudget` 필드 자체는 다른 화면(고정지출 합계 카드의 보조 카피 등)을 위해 `BudgetSummary`에 그대로 남아 있다.

합계 카드의 `/stats`(§12.9, 이번 사이클 소비 구성 분해) 진입은 **카드 하단 채운 회색 알약(`bg-muted`) 버튼 「◐ 소비 구성 보기 ›」(실제 링크) 하나뿐**이다 — 카드 전체를 덮던 stretched-link 오버레이는 **제거**됐다. 히어로가 저축 모드에서 「나간 돈」(= 모으기+고정+소비)인데 /stats는 「소비 구성」(= 고정+소비만) 분해라, 카드 전체 탭이 "나간 돈 → 소비만"으로 오인되는 것을 막기 위함이다(저축 0이어도 동일하게 CTA만 링크). own 모드 + 현재 사이클 + 수입 > 0일 때만 노출하고(과거 사이클·친구 모드·미설정 시 숨김), /stats 상단 총액은 「소비 구성」(고정+소비)이라 히어로 「나간 돈」과 다를 수 있다(의도).

### 12.3 Add / Edit Transaction

소비 추가와 수정은 같은 UI를 사용한다.

입력 필드:

- 카테고리
- 금액
- 결제수단 (신용카드 / 체크카드, 필수)
- 메모 (선택, 최대 100자)
- 날짜
- 공개 범위 (전체 공개 / 부분 공개 / 비공개)

결제수단은 「상세 정보」 카드 첫 행의 2-세그먼트 토글(신용/체크, `VisibilitySelector`와
같은 알약 스타일)이다. 새 소비는 직전 사용 결제수단을 기본값으로 깐다(localStorage,
고정 기본값은 신용/체크 비율을 오염시키므로). 수정 시엔 해당 거래의 값을 채운다.
결제수단 컬럼 도입 전 legacy 거래는 값이 없어 §12.9에서 "미지정"으로 집계된다.

**할부** — 결제수단이 **신용카드**일 때만 결제수단 아래에 「할부」 행이 노출된다
(native select: 일시불 / 2~36개월; 체크로 바꾸면 일시불로 리셋). 할부는 회계 모델
**B1**을 쓴다: 할부 1건을 N개월치 **자식 거래 행**으로 materialize해 각 회차를 해당 달
소비로 잡는다(기존 주기·그리드·친구·합계 로직 무수정 재사용).

- **구매월 시작**: 1회차 = 구매월(당월), 이후 매달 같은 day(월말 없는 날 clamp). Phase 1
  '일시불=당월'과 일관 — 실제 카드 청구(다음 달)와는 어긋나지만 소비 인식(쓴 시점) 우선.
- **무이자 가정(v1)**: 원금을 N등분, 우수리는 첫 회차에(한국 카드 관행, Σ회차=원금).
  수수료 미모델링. 금액 입력 = 원금 총액(월 부담 힌트 표기).
- **신용 전용**: 체크카드는 할부 없음. 회차 행의 payment_method는 모두 credit.
- **전체 삭제만(v1)**: 개별 회차 수정 불가. 할부 자식을 탭하면 폼이 일반 수정 대신 정보 +
  "할부 전체 삭제"만 보여준다(`installment_id`로 그룹 soft-delete). 금액·개월 변경 = 삭제 후
  재등록.
- 미래 회차는 미래 주기라 현재 대시보드/그리드/합계에 안 잡힌다(주기 범위 밖 — 그 달이 와야
  보인다).

**나눠내기(정산)** — 친구와 나눠 낸 소비의 **내 몫만** 기록하기 위한 기능. 금액 입력칸
바로 아래 **한 줄 트리거 행**(「여러 명이 나눠 냈어요」, 나눈 뒤엔 「N명이 나눔 · 내 몫
X원」)만 두고, 인원 칩은 **nested drawer**로 뺀다(공개범위 「부분」의 `GroupPickerDrawer`와
동일한 `DrawerNestedRoot` 패턴) — 인라인 확장이 폼 세로를 크게 늘려 §3 핵심 숫자 우선을
해쳤기 때문. drawer 안에 `SplitChips`(고정지출 셰어 칩 재사용) 인원 칩 **혼자 다 / 2명 /
3명 / 4명**을 띄우고, 칩을 누르면 즉시 적용하고 닫는다(단일 선택이라 버퍼/커밋 불필요).

- **총액 입력 → 인원 선택 → 내 몫**: 금액칸에 결제한 총액을 넣고 인원 칩(2~4명)을 누르면
  금액칸이 `round(총액/N)`(내 몫)으로 바뀐다. 「혼자 다」는 분할 해제(총액 복원).
- **내 몫만 저장**: `amount`엔 내 몫만 담기고, 총액(`split_total`)·인원(`split_count`)은
  **표시용 메타 컬럼**으로만 남는다. amount가 곧 내 몫이라 예산·주기·그리드·친구·/stats 등
  **기존 쿼리는 이 행을 일반 거래로 그대로 취급**한다(할부 B1과 같은 철학 — 쿼리 무변경).
  반올림 우수리(최대 N-1원)는 소비 인식 앱 특성상 무시(계산 로직 = tested
  `lib/utils/split.ts::computeShare`, DB CHECK: 둘 다 null 또는 둘 다 set·2~4·총액>0).
- **표시**: 내역 아이템은 카테고리/메모 아래 「총 X원 · N명 나눔」 한 줄(own 전용). **친구
  모드에서는 숨긴다** — 친구는 이미 내 몫(amount)을 보므로 총액·인원까지 노출하지 않는다.
- **할부와 상호배타(v1)**: 할부와 나눠내기는 함께 못 쓴다. 나눠내기가 켜지면 할부 행이,
  할부가 켜지면 나눠내기 토글이 숨는다(서버도 이중 방어). 결제수단은 신용/체크 무관.

추가 모드:

```txt
소비 추가
[카테고리]
[금액]
[결제수단]
[메모]
[날짜]
[추가하기]
```

수정 모드:

```txt
소비 수정
[카테고리]
[금액]
[결제수단]
[메모]
[날짜]
[수정하기]
[삭제하기]
```

카테고리 필드 규칙:

- 칩 가로스크롤이 아니라 **단일 탭 행**이다(날짜 행과 같은 스타일: 아이콘 + 선택된 카테고리 이름 + `ChevronRight`). 탭하면 **카테고리 picker drawer**가 열린다(`DrawerNestedRoot` 1개, 폼 위에서 nested).
- picker drawer는 선택뿐 아니라 **생성/수정/삭제까지 처리하는 카테고리 관리의 유일한 home**이다. 별도 `/settings/categories` 라우트는 두지 않는다.
- **선택 모드(기본)**: row 탭 = 선택 + drawer 닫힘. 맨 아래에 `➕ 새 카테고리` row. 헤더 trailing에 `편집` 토글.
- **편집 모드**: seed 카테고리는 🔒 잠금(수정·삭제 불가), 사용자 커스텀 row만 탭하면 수정 view로 전환된다. `완료`로 선택 모드 복귀.
- 생성/수정 폼은 **새 drawer를 더 쌓지 않고** picker drawer 내부에서 list ↔ form view 전환으로 처리한다(3중 vaul 중첩 회피, §19). form view는 이름(최대 10자, 카운터), 아이콘 그리드(24종 고정 allowlist), 색상 swatch(고정 팔레트)로 구성한다.
- 커스텀 카테고리는 사용자당 **최대 20개**. 이름은 1~10자, 동일 이름 중복 불가(서버 액션이 친절한 에러 토스트로 안내).
- 삭제는 AlertDialog 확인 후 진행하며("이 카테고리를 삭제할까요?", 본문 "이 카테고리로 기록한 소비는 '기타'로 옮겨져요."), 그 카테고리로 찍힌 소비를 **`기타` seed로 재배정**한다(미분류·null 아님). 재배정+삭제는 `delete_category` SECURITY DEFINER RPC가 한 트랜잭션으로 처리한다.
- 마지막 사용 카테고리를 기본값으로 기억하지 않는다 — 추가 모드 기본 선택은 항상 `categories[0]`.
- 친구 모드에서는 FAB·폼이 마운트되지 않으므로 picker도 노출되지 않는다. 단, 친구가 owner의 커스텀 카테고리로 기록한 소비는 라벨/아이콘/색이 정상 표시되어야 하며, 이는 `get_user_categories(target)` RPC 백필로 보장한다(§12.8 참조).

메모 필드 규칙:

- 한 줄 텍스트 입력, placeholder "무엇에 썼나요?".
- 최대 100자. 입력란 우측 상단에 `현재길이/100` 카운터를 표시한다.
- 비워두면 저장 시 `null`로 정규화한다 (앞뒤 공백 제거 후 빈 문자열도 동일).
- 메모를 비우거나 수정하는 것이 곧 추가/수정/삭제다. 별도 메모 삭제 액션은 두지 않는다.

공개 범위 (Visibility) 규칙:

- 라디오 3옵션 — **전체 공개 / 부분 공개 / 비공개**. DB enum `transactions.visibility = 'all' | 'groups' | 'private'`과 1:1 대응.
- 전체 공개 (기본값): 모든 친구가 본다.
- 부분 공개: 선택한 친구 그룹에 속한 친구에게만 보인다. 옵션 행 trailing의 "N개 그룹" 버튼을 탭하면 `DrawerNestedRoot` 기반 그룹 멀티 체크박스가 열린다. 0개 선택 상태로는 저장이 차단된다(클라이언트 + `submitTransactionAction` 서버 가드 이중).
- 비공개: 친구에게 보이지 않으며 합계에서도 빠진다.
- 사용자가 가진 그룹이 0개라면 "부분 공개" 옵션은 비활성화되고 보조 카피로 "그룹 관리"(`/friends/groups`) 진입 링크를 노출한다.
- 저장은 `transactions` 행과 `transaction_visibility_groups` 링크를 한 트랜잭션에서 처리하는 `create_transaction_with_visibility` / `update_transaction_with_visibility` SECURITY DEFINER RPC로만 한다. realtime watcher가 거래는 보였는데 가시성 링크는 비어있는 부분 상태를 보지 않게 보장한다 (§12.8.9).

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

할부 자식 거래는 카테고리명 옆에 "N/M회차" 배지를 단다(§12.3 할부) — 최소 표시 원칙의
유일한 예외. merchant/영수증 등 다른 부가 정보는 여전히 행에 넣지 않는다.

예시:

```txt
식비        5월 11일        12,000원
카페        5월 10일         5,500원
교통        5월 10일         1,500원
```

항목을 누르면 수정 Sheet 또는 Dialog를 연다.

### 12.5 Settings

Settings는 주제별 섹션으로 묶는다. **저장 버튼이 없다 — 필드별 자동저장**(알림 토글과 같은 즉시-저장 패턴). 위→아래 순서:

- **내 정보** — 닉네임(친구가 보는 이름. 가입 시 한국어 자동 닉네임이 시드되며, 최대 20자, 공백/탭/줄바꿈 금지. 빈값이면 친구 화면에서 "이름 없음"으로 폴백 §12.8.7). blur 시 자동저장.
- **예산** — 월 수입(blur 시 자동저장) · 예산 주기(§12.5a). 「돈 들어오는 날」 picker(§12.5a의 큰 radio 카드)는 랜딩에 펼치지 않고 **값 요약 row→drawer(1 depth)**로 접어, 자주 안 바꾸는 설정이 화면을 길게 만들지 않도록 한다. picker는 부모 state를 갱신하고 **drawer가 닫힐 때 자동저장**한다("확인"도 닫기일 뿐, 별도 저장 버튼 없음 — 카테고리 picker drawer 패턴 §12.3).
- **알림** — 친구 소비 알림 · 반응/댓글 알림. 둘 다 푸시이며 `user_settings`의 독립 플래그 2개다(§14, migration 0035). 토글 즉시 저장.
- **기타** — 기능 안내 다시 보기(롱프레스 가이드 플래그 리셋).
- **계정** — 로그아웃 · 앱 버전 표기.

**자동저장 모델**: 필드별 서버 액션(`saveNicknameAction`/`saveIncomeAction`/`saveCycleAction`)이 각자 자기 필드만 검증·upsert한다 — 한 필드 blur가 다른 필드를 재검증하지 않으므로, 닉네임을 비운 채 수입을 고쳐도 막히지 않는다. 성공은 해당 필드 옆 "저장됨 ✓" 마이크로 표시(약 1.5s 후 소멸), 실패는 toast. **에러 시 동작은 비대칭이다**: 텍스트 필드(닉네임·수입)는 입력값을 **유지**해 사용자가 고쳐 재-blur하게 하고(재타이핑 강요 금지), 주기 picker는 편집 텍스트가 아니라 값 요약 row라서 직전-저장값으로 **복원**한다(저장 안 된 상태를 거짓 표시하지 않게).

친구 진입점은 설정이 아니라 대시보드 헤더의 친구 칩/omnibox 시트다(§12.8). 설정 닉네임 섹션에는 친구 수·친구 링크를 두지 않는다 — 진입점 중복을 피한다. 레거시 `/friends` 라우트는 `/dashboard`로 리다이렉트되는 북마크 호환 스텁이다.

추가 수입 등록과 월 고정지출은 설정에 두지 않는다(진입점 중복 제거). 추가 수입은 대시보드 FAB 롱프레스 메뉴 + 소비 요약의 수입 라인에서 등록하고, 월 고정지출은 하단 탭 nav → `/fixed-expenses`에서 항목별로 관리한다(§12.7).

카테고리 관리는 Settings가 아니라 **소비 폼의 카테고리 picker drawer**에서 한다(§12.3). 별도 Settings 항목이나 `/settings/categories` 라우트는 두지 않는다.

향후 확장 가능 항목:

- 앱 잠금
- 데이터 내보내기

MVP에서는 노출하지 않는다.

### 12.5a Budget Cycle (Model B — 입금 앵커)

예산 집계 주기는 사용자에게 **"돈 들어오는 날" 하나만 묻되**(월급·용돈·입금 등 페르소나 무관한 범용 표현 — 직장인 한정 "월급날"은 쓰지 않는다), 내부적으로는 **실제 급여가 입금되는 날(예측)에 주기를 앵커링하는 Model B**로 동작한다. 예전의 `calendar`/`income_day` 2모드 매핑(사용자 모델)은 폐기됐다 — 두 값은 컬럼으로만 deprecate-보존되며, 주기 계산에는 더 이상 쓰이지 않는다.

사용자 설정 두 가지 (`user_settings`):

- **급여일 `payday`** (smallint) — `0 = 말일`(`payment-day.ts`의 `0=말일` 관례를 공유), `1..28 = 그 날`. DB 기본값 1.
- **급여 규정 `payroll_rule`** (text) — 급여일이 주말·공휴일과 겹칠 때 실제 입금 기준을 고른다: `prev`=이전 영업일(기본), `same`=보정 안 함(당일), `next`=다음 영업일.

주기 계산 (순수 함수, `lib/utils/payday-cycle.ts`):

- **영업일** = 토·일이 아니고 `holidays` 테이블에도 없는 날. 주말은 코드(`getDay()`)로, 공휴일만 테이블에 저장한다.
- 월 M **명목 급여일** = `payday===0`이면 그달 마지막 날, 아니면 N일. **입금일** = `adjustToBusinessDay(명목일, payroll_rule, holidays)`(prev=직전 영업일로 당김 / next=다음 영업일로 밈 / same=그대로).
- **주기 앵커** `anchor = 입금일 + (말일 ? +1일 : +0)` — 말일 급여는 다음 추적 구간의 재원이므로 입금일 다음 날이 앵커다(앵커는 주말일 수 있으며, 입금일이 아니라 주기 경계 마커일 뿐).
- **주기** = `[anchor(월 M), anchor(월 M+1))`. 경계는 실제로 이동한다 — 예) 1월 주기가 12/31에 시작될 수 있다(의도된 동작).
- **라벨 월**: `payday` 1·2~28 = 입금월 그대로. `말일` = +1월(다음 달). 예) 1월 말일 입금 → "2월"로 라벨.
- 헬퍼 `getCycleRangeB`/`resolveDashboardParamsB`가 resolution 레이어를 담당하며, `formatCycleLabel`/`formatCycleLabelLong` 등 라벨 헬퍼는 `lib/utils/calendar.ts`에서 재사용한다.

2026 검증 (규정 = `prev`): `payday=1` 1월 → 2/1(일)이 명목 다음달 앵커라 prev로 1/30 → 주기 `[2025-12-31, 2026-01-30)` 라벨 "1월"(1/1 신정·목 → prev → 12/31). `payday=20` 1월 → 1/20(화) 영업일 → `[1/20, 2/20)`. `payday=말일` 1월 → 1/31(토) → prev 1/30, +1일 = 1/31 → `[1/31, 2/28)` 라벨 "2월".

UI 구성 (월 수입 입력 다음):

- 라벨 "돈 들어오는 날" + 보조 설명 "월급·용돈처럼 돈이 들어오는 날에 맞춰 소비를 집계해요."
- 단일 Select 하나 (옵션: "1일"~"28일" + "말일 (매월 마지막 날)"). 29/30/31은 노출하지 않는다 — 진짜 말일 급여자는 "말일"을 고른다.
- 그 아래 **급여 규정은 기본 접힘**(점진적 노출 — 주말·공휴일 보정이 필요한 사람만 펼친다): 항상 보이는 행 "주말·공휴일 겹칠 때" 우측에 **현재값 라벨 + chevron**을 노출한다(안 펼쳐도 상태 확인 가능). 탭하면 RadioGroup 3옵션이 펼쳐진다 — `앞당겨 들어와요`(기본, prev, 헬퍼 "예: 토요일이면 금요일") / `날짜 그대로`(same) / `미뤄서 들어와요`(next, 헬퍼 "예: 토요일이면 월요일"). 추상 워딩("이전/다음 영업일")은 페르소나-중립 구체 표현으로 교체했다. **모드(달력형/세부형) 분리는 하지 않는다** — 모드 포크는 분류 질문을 강제해 단순 유저에게 메타 결정 세금을 물리므로, 점진적 노출이 우선이다.
- **계층 표현(상위/하위)**: 같은 카드 안에서 "언제 들어와?"(radio 3개)는 `bg-card`로 떠 있는 **상위**, "주말·공휴일 겹칠 때" 보정 + 주기 프리뷰는 `bg-muted/60`로 면을 낮춘 **하위(종속) zone**이다. 카드를 2장으로 쪼개지 않는다 — 분리는 "동등한 두 설정"으로 읽히지만, 보정은 위 선택에 딸린 종속 컨트롤이므로 면 깊이(plane recession)로 위상차를 표현한다. 하위 행은 좌측에 `CalendarSync` 아이콘(muted, radio 동그라미와 구분되는 "선택지 아닌 보정 컨트롤" 신호) + 라벨 톤다운으로 한 단계 가라앉힌다. 프리뷰는 zone 맨 아래 tier-3로 가장 흐리게.
- 그 아래 상시 안내 한 줄(이번 주기 프리뷰): 주기가 정확히 달력 월(1일~말일)과 일치하면 평서문 "이번 달 소비를 1일부터 말일까지 모아서 보여드려요.", 그 외(이동·말일 케이스)는 "이번 주기: 5월 25일 – 6월 24일" 형태의 실제 입금앵커 기간 프리뷰(휴일 반영). 말일은 자연히 다음달 라벨로 표시된다.

`cycleMode`(`calendar`/`income_day`)는 더 이상 저장값이 아니라 **파생값**이다 — `getCycleRangeB`가 주기가 정확히 `[1일, 다음달 1일)`일 때만 `calendar`, 그 외 모든 이동·말일 주기는 `income_day`로 도출한다. 덕분에 하위 소비자(`spending-month-grid.tsx`의 가변행 그리드, 페이스 라인 카피 등)는 무변경으로 동작한다. 매핑은 `lib/utils/calendar.ts`의 순수 함수 `paydayCodeToDb`/`dbToPaydayCode`/`PAYDAY_OPTIONS`가 단일 출처이며(picker `PaydayCode` ↔ `payday` smallint), `components/settings/settings-form.tsx`는 picker 선택을 `payday` smallint + `payroll_rule`로 변환해 drawer가 닫힐 때 `saveCycleAction(payday, payrollRule)`로 자동저장한다(폼 제출 없음, §12.5).

휴일은 **Supabase `holidays` 테이블**(컬럼 `d date` PK + `name text`)에 저장한다. 인증 유저 전체 읽기 가능(공휴일=비민감), 쓰기는 SQL editor/service role 전용(SELECT 정책만 존재). 주기가 연 경계를 넘으므로(1월 주기가 전년 12월 시작, 12월 말일 주기가 다음해 1월 종료) `getHolidays`는 앵커 연도 ±1년을 로드한다(`holidayRangeForAnchor`). 휴일 테이블은 **매년 직접 갱신**해야 한다(공휴일 INSERT). 조회 실패 시 빈 Set으로 graceful degrade하여 모든 날을 영업일로 취급한다.

마이그레이션 백필은 **lossy·의도적**이다: 기존 `calendar` 모드 행(과거에 1일·말일 둘 다 흡수)은 일괄 `payday=1`이 되므로, 실제 말일 급여자는 설정에서 "말일"을 다시 골라야 한다(1일 급여자와 구분 불가). 레거시 `income_day` 2~28 → `payday=N`, 29~31 → `payday=0`(말일).

친구 대시보드는 친구 본인의 사이클을 그대로 사용한다. 친구의 `monthly_income`은 노출하지 않으며, `get_user_cycle` RPC가 주는 `(payday, payroll_rule)` 2개 + 공개 `holidays`만으로 **JS(`payday-cycle.ts` 엔진)가 친구 주기를 직접 계산**한다(SQL 영업일 함수 불필요). RPC는 friendship 관계가 있는 viewer에게만 row를 반환하며 income은 영원히 비노출이다. 친구 모드 대시보드의 화면 동작 전체는 §12.8.5 참조.

### 12.7 Fixed Expenses

`/fixed-expenses`에서 매달 빠지는 항목(월세, 통신비, 보험, 구독 등)을 개별 항목으로 관리한다. 대시보드가 "결과 확인" 화면이라면 이곳은 "구성 관리" 화면이다.

목적:

- 매달 빠지는 돈을 한눈에 확인
- 가용 예산 = 월 수입 − **활성** 항목 합계 (해제된 항목은 빠짐) 계산의 정확도 확보

화면 구성 (위에서 아래):

1. **합계 카드** — "매달 고정지출" 라벨 + 우상단 개수 칩(파란 점 + "총 N개 항목") + 큰 금액(40px) + **연간 환산** 행(`합계 × 12`, recessed plane `bg-muted/60` 위 보조 숫자). 연간 환산은 핵심 숫자(월 합계)보다 작은 weight·muted로 눌러 월 숫자가 단일 지배 figure로 남게 한다(§3). 금액 미입력 항목은 0으로 합산돼 연환산도 불완전할 수 있다(월 합계와 동일 한계).
2. **사용 중 섹션** — 활성 항목 카드 리스트. 섹션 헤더 우측에 "결제일 순" 정적 라벨(드롭다운 아님 — chevron 미표시). 각 행: 이름 / 결제일 subline("매월 N일" · 없으면 "결제일 미정") / 우측 금액 + **행별 연환산("연 N원")** + (`amount < 카탈로그 default_amount`일 때)"원래 N원". 정가보다 싸게 내는 항목은 "원래 N원" 보조라인으로만 표기하고 별도 태그(「셰어」 등)는 두지 않는다. 아이콘 배지도 두지 않는다. plan_name은 행에 표시하지 않고 편집 시트에서만 본다. 항목 탭 시 액션 Sheet (금액 수정 / 해제 / 삭제)
3. **직접 추가 CTA** — 카탈로그에 없는 항목(월세, 통신비 등)을 입력하는 진입점. **풀폭 primary 버튼**("+ 직접 추가하기" + 보조카피 "카탈로그에 없는 항목을 직접 입력해요"), 사용 중 섹션 아래·카탈로그 위에 둔다.
4. **카탈로그 검색** — 회색 채움(`bg-muted`) 검색 입력. 카탈로그만 좁히고 사용 중 섹션엔 영향 없음. sticky.
5. **카탈로그 필터 칩** — "전체" + 카테고리(AI / OTT / 음악 / 멤버십 / 배달 / 교통 / 생산성 / 독서·교육 / 클라우드). 각 칩 우측에 **서비스 개수 배지**(플랜 수 아님). 활성 칩은 앱 공통 컨벤션(primary border + primary/10)을 따른다(검정 칩 아님).
6. **카탈로그 그룹 섹션** — 카테고리 그룹별 **흰 카드** 안에 서비스 행을 담고, 행 사이 divider(divider 위 여백을 아래보다 살짝 넓게). 각 서비스 행: 서비스명 + (해외결제 서비스면)"해외결제" 노트 + 그룹별 **사각칩 그리드**(rounded-11px, 알약 pill 아님). 그룹 헤더에 서비스 개수. 사용자는 본인이 쓰는 항목을 눌러 활성화한다.

카탈로그 버튼 상태(사각칩, rounded-11px):

- 비활성 (회색 채움 `bg-muted` + 보더 없음): 플랜명 + 기본 금액 표시. 탭 시 금액 확인 Sheet 오픈 → 사용자가 금액 확인/수정 후 "사용 중으로 추가하기"
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

그 날 빠지는 **고정지출도 같은 리스트에 합쳐** 보여준다(별도 "이 날 빠지는 고정지출" 섹션 없음). 고정지출은 변동소비보다 **위에 고정**되며, 거래 row와 동일한 아이콘-원형 레이아웃을 쓴다 — 아이콘/색은 `fixed_expenses.category`(AI/OTT/음악/…)에서 파생하고, 직접추가(카테고리 없음) 항목은 중립 `repeat` 아이콘을 쓴다. 각 고정지출 row에는 작은 **「고정」 뱃지**를 달아 변동소비와 구분하고, 이번 주기 금액이 보정된 항목은 **「이번 달」 뱃지**를 함께 단다. own 모드에서 고정지출 row를 누르면 그 주기만 금액을 바꾸는 override 시트를 연다(§12.7) — 변동소비 row의 수정 dialog와 다른 시트다. 날짜 헤더 합계는 고정지출 + 변동소비를 합산해, 모든 날의 합이 핵심 숫자 "쓴 돈(고정+변동)"과 일치한다. 캘린더 그리드 셀 금액·색칠도 같은 기준(고정지출 + 변동소비)을 쓴다(B-full) — 셀 숫자는 그 날 헤더 합계와 일치하고, 색칠 기준(일 허용치 = 분모/30)의 **분모는 고정지출을 뺀 가용 예산이 아니라 수입 전체(추가수입 포함)**다. 고정지출을 날짜 셀에 더하면서 분모에서도 빼면 고정지출을 두 번 차감하게 되므로 분자(고정 포함)와 분모(수입 전체)를 세트로 맞춘다. 그 결과 고정 결제일은 큰돈이 한 번에 나가 자연히 warning/danger로 강조된다 — 예측 가능한 지출이지만 "그날 실제로 나간 돈"을 정직하게 드러내는 의도다. 친구 모드에서도 owner가 **소비 내역 + 고정지출 항목**을 둘 다 공개한 경우 같은 방식으로 친구의 고정지출을 달력 셀·day 리스트에 합쳐 보여준다(B-full) — 이때 §12.8의 별도 "친구의 고정지출 합계" 카드는 띄우지 않는다. 단 친구 모드는 수입이 비공개라 색칠 분모(`cycleBudget`)가 0 → 셀은 전부 무색(분류 없음), 숫자만 커진다. 고정지출 row는 친구 모드에선 비-인터랙티브(override 시트 없음)이고 「이번 달」 뱃지도 뜨지 않는다(서버가 friend에게 `is_overridden=false`/`base_amount=null` 반환). 날짜 미정(payment_day=null) 친구 고정지출은 달력에 박을 날짜가 없어 fold 모드에서 노출되지 않는다(의도된 누락). owner가 고정지출 **항목**은 비공개로 두고 합계만 공개했거나, 소비 내역을 비공개로 둬 달력 자체가 안 뜨는 경우엔 §12.8의 별도 요약(합계 카드 / 항목 리스트)으로 폴백한다.

**저축(돈모으기) 적립일도 같은 달력에 표시한다(own 모드).** active `savings_plans` 중 적립일(payment_day)이 있는 항목을 그 날 셀에 **녹색(#1c8c4d) 점**으로, day 리스트에는 **「모으기」 뱃지**를 단 녹색 틴트 row(이름 + 금액)로 보여준다(「고정」 뱃지 미러, `expandFixedExpensesByDay` 재사용). **단 저축은 그날 헤더 합계·셀 색칠 분류에 더하지 않는다** — 헤더 합계는 「쓴 돈(고정+변동)」 불변식을 유지하고 색칠 분모/분자도 그대로다(저축은 소비가 아니므로 적립일이 warning/danger로 바뀌지 않는다). 이 마커는 히어로 「나간 돈」(저축 포함, §12.2)과 달력 「쓴 돈」의 차이를 시각적으로 메운다 — 예: 1일에 적금 100만이 빠져 「나간 돈 > 쓴 돈」인 이유가 달력에서 드러난다. 적립일이 없는(payment_day=null) 저축은 박을 날이 없어 조용히 생략하고(고정지출의 undated nudge 같은 보정 affordance는 두지 않는다), 적립 row는 비-인터랙티브다(편집은 /savings, §12.10). **친구 모드에서는 owner가 `show_savings_items`를 켠 경우에만** 저축 마커를 띄운다 — 저축은 수입만큼 사적이라 기본 비공개이고(§12.10, §19), 켜진 경우 친구 read는 `get_friend_savings_items` RPC(컬럼 통제, `show_savings_items AND show_spending_items` 재검사 — §12.8.3)로만 가져와 own과 같은 비-counted 마커로 그린다.

`calendar` 모드에서는 7×6 고정 그리드(다른 달 일부 회색)로 한 달 전체를 보여준다. `income_day` 모드(§12.5a)에서는 사이클 첫날부터 끝날까지만 렌더하는 **가변 그리드**를 사용한다. 첫 행 들여쓰기는 사이클 시작일의 요일에 따라, 마지막 행 패딩은 사이클 끝일 요일에 따라 결정되며, 행 수는 4~6 가변이다. MonthSwitcher의 이전/다음 버튼은 항상 사이클 단위로 이동하며 라벨은 모드에 따라 "5월" 또는 "5/20 – 6/19" 형식이다.

### 12.8 Friends

티끌은 친구의 이번 달 또는 사이클 소비 흐름을 함께 들여다볼 수 있는 가벼운 공유 기능을 제공한다. 가계부 공유나 정산 도구가 아니다. owner가 친구별로 노출 항목을 선택적으로 켜고 끌 수 있으며, 어떤 조합에서도 `monthly_income` / 가용 예산 / 소비율은 절대 공유하지 않는다.

#### 12.8.1 목적과 원칙

- 노출 가능 항목은 6가지다 — **총 소비 금액**, **소비 내역(캘린더+거래 리스트)**, **고정지출 합계**, **고정지출 항목**, **모은 돈 합계**, **모으기 적립일**. 앞 4개는 독립 토글이고, 뒤 2개(저축)는 대응하는 소비 토글(총 소비↔모은 돈 합계, 소비 내역↔모으기 적립일)이 켜져 있어야만 켤 수 있다 — 저축은 소비 surface(히어로·캘린더)에 얹혀 보이기 때문이다(§12.10). 저축은 수입만큼 사적이라 기본 비공개(default false)다.
- 친구의 `monthly_income` / 가용 예산 / 소비율 / progress bar는 어떤 토글 조합에서도 노출하지 않는다 (§19). 이를 노출하는 RPC도 존재하지 않는다.
- 페어링은 **양방향 자동**이다. 한쪽이 코드를 발급하고 다른 한쪽이 입력하면 양방향 friendship row가 한 번에 만들어진다. 한쪽이 해제하면 양쪽 모두 즉시 끊긴다. 노출 토글은 **방향별 독립** — 내가 친구에게 보여주는 항목과 친구가 나에게 보여주는 항목은 별개 row의 별개 컬럼이다.
- 기존 친구 관계의 기본값은 backward-compatible — 총 소비/소비 내역은 ON, 고정지출 합계/항목은 OFF.
- 친구 데이터도 본인 데이터와 동일하게 캐시 금지다 (§16.2, §19).

#### 12.8.2 데이터 모델

세 테이블을 사용한다.

- `friend_codes` — 6자 코드(혼동 글자 `0/O/1/I` 제외 32자 알파벳), 10분 TTL, 단일 사용. 동일 owner가 새 코드를 발급하면 기존 활성 코드는 즉시 만료 처리한다.
- `friendships` — 양방향 두 row(`owner_id`, `viewer_id`). `owner_id ≠ viewer_id` 제약과 `(owner_id, viewer_id)` UNIQUE. 가시성 컬럼 6개(`show_spending_total`, `show_spending_items`, `show_fixed_total`, `show_fixed_items`, `show_savings_total`, `show_savings_items`, 모두 `boolean not null`; 저축 2개는 default false)가 owner의 outbound row에 저장된다 (`0031_friend_visibility_scope.sql`, 저축은 `20260512100057`).
- `redeem_attempts` — 코드 입력 rate-limit 로그. 60초 윈도우 안 5회까지 허용.

`transactions`와 `profiles`는 friendship row가 있을 때 viewer에게 SELECT가 허용된다(`0019_friendship_view_policies.sql`, `0031_friend_visibility_scope.sql`). `transactions` SELECT는 `show_spending_items=true`일 때만 허용한다. `fixed_expenses`도 동일하게 `show_fixed_items=true`일 때만 허용한다(`0031`). `profiles`는 닉네임 표시용이라 토글에 영향받지 않는다. `user_settings`는 RLS로 친구에게 직접 노출하지 않는다 — 사이클은 아래 RPC로만 접근한다.

#### 12.8.3 RPC

모든 함수는 `SECURITY DEFINER`로 정의하며 `authenticated` 역할에만 grant한다. SECURITY DEFINER가 RLS를 우회하므로 본문 안에서 friendship + 토글을 직접 체크한다.

- `redeem_friend_code(p_code text) returns text` — 호출자가 viewer가 된다. `for update`로 코드 row를 잠가 동시 redemption을 막은 뒤 `friendships` 양방향 row를 `on conflict do nothing`으로 INSERT하고 코드를 사용 처리한다. 반환값은 정확히 `ok` / `invalid` / `self` / `unauthenticated` 4종이며, 어떤 케이스인지 외부에 누설하지 않기 위해 만료/존재하지 않음/이미 사용됨을 모두 `invalid`로 묶는다.
- `get_user_cycle(target uuid) returns table(payday smallint, payroll_rule text)` — 호출자가 본인이거나, `target = owner_id ∧ caller = viewer_id`인 friendship row가 있을 때만 한 줄을 반환한다(Model B). 친구 주기는 이 `(payday, payroll_rule)` + 공개 `holidays`로 JS가 계산한다. `monthly_income`은 시그니처에 포함되지 않으므로 RPC 자체가 노출 차단의 마지막 방어선 역할을 한다(예전의 `cycle_mode`/`cycle_start_day` 반환은 폐기).
- `get_friend_spending_total(target uuid, start_iso timestamptz, end_iso timestamptz) returns numeric` — 합계만 노출하는 경로용. friendship + `(show_spending_total OR show_spending_items)`을 체크하고, `deleted_at IS NULL` 행만 합산한다. **항목 토글이 꺼진 케이스에서 viewer가 row를 직접 SELECT 할 수 없도록 row 단위 RLS는 차단된 상태로 두고, 합계는 이 RPC를 통해서만 얻는다.**
- `get_friend_fixed_total(target uuid) returns numeric` — 위와 동일한 패턴으로 고정지출 합계를 반환한다. `is_active = true` 행만 합산하고 `(show_fixed_total OR show_fixed_items)`을 체크한다.
- `get_friend_savings_total(target uuid) returns numeric` / `get_friend_savings_items(target uuid) returns table(...)` — 저축 친구 노출용(`20260512100057`). **`savings_plans`는 RLS를 own-only로 둔다** — 고정지출과 달리 friend RLS 정책을 추가하지 않는데, `opening_balance`(누적 자산)·`goal_amount`가 행에 있어 RLS 행 노출 시 그것까지 새어나가기 때문이다. 그래서 친구 read는 이 두 RPC로만 하며, items RPC는 마커에 필요한 컬럼만 반환한다(opening_balance/goal 비노출). 두 RPC는 저축 플래그뿐 아니라 **대응 소비 플래그까지 AND로 재검사**한다(total↔`show_spending_total`, items↔`show_spending_items`) — 토글 UI 비활성은 보조일 뿐, stale 플래그가 직접 RPC 호출로 새지 않게 데이터층에서 결합을 강제한다. total은 ongoing(active·시작·미만기, KST 기준) 합계라 owner 히어로 「매달 모으는 돈」(thisMonthSaved)과 같은 값이다.

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
  - 블럭 1: 총 소비 카드. `friendView` 분기 사용 — **가용 예산·소비율·progress bar·남은 돈·수입 보조 카피는 일절 표시하지 않는다**(전부 `monthly_income` 파생이라 비공개). 단 owner가 고정지출 가시성(`show_fixed_total ∨ show_fixed_items`)을 켜고 소비 총액도 공개한 경우, 헤로를 **진짜 총 소비(고정+변동)**로 바꾸고 그 아래 `● 고정 X · ● 변동 Y` 분해 한 줄을 단다(`showFixedBreakdown`). 고정·변동 합계는 이미 공개된 집계라 income/예산/소비율을 역산할 수 없다 — own 모드 분해 라인에서 `% 사용`·progress·상태색만 떼어낸 형태다. 고정 가시성이 없으면 헤로는 변동소비만(현행). owner가 `show_savings_total`(+`show_spending_total`)을 켠 경우, 모은 돈(`friendSavings`)을 **헤로에 합산**하고 헤로 라벨을 「총 소비」→「나간 돈」으로 바꾼다(own 모드와 동일 — 저축은 소비가 아니라 "나간 돈"으로 정직하게 묶는다). 그 아래 「● 모으기 N원」 녹색 분해 라인을 덧붙인다(고정·변동 라인과 별행). 즉 친구 헤로 = (고정+변동 또는 변동) + 모으기. 셋 다 이미 공개된 집계라 income/예산/소비율을 역산할 수 없다. `friendSavings === 0`이면 라벨은 「총 소비」 그대로(현행).
  - 블럭 2: 캘린더 + 일별 거래 리스트. 거래 row는 클릭 비활성(`readOnly={true}`). **소비 내역 + 고정지출 항목을 둘 다 공개한 경우** owner의 고정지출을 이 캘린더 셀·day 리스트에 합쳐(B-full, §12.6) 노출하고, 이때 블럭 3·4는 띄우지 않는다.
  - 블럭 3: 친구의 고정지출 합계 카드. "친구의 고정지출 합계" 라벨 + 합계 헤로. owner-context 푸터("가용 예산 계산에 반영돼요")는 친구 모드에서 의미가 없으므로 제외한다. **블럭 1(요약 카드)이 이미 고정 합계를 분해 라인으로 보여주는 경우엔 렌더하지 않는다**(`summaryShowsFixedSplit = show_spending_total ∧ (show_fixed_total ∨ show_fixed_items)` — 같은 숫자 중복 방지). 즉 이 카드는 **소비 총액이 비공개라 블럭 1이 안 뜨는데 고정 합계만 공개된** 경우의 폴백 요약이다. 블럭 2에 고정이 합쳐진 경우(소비+고정 항목 동시 공개)에도 띄우지 않는다.
  - 블럭 4: 고정지출 항목 리스트. 카탈로그 그리드/검색/필터/추가 컨트롤은 보여주지 않는다(클릭 불가, read-only). 소비 내역까지 공개돼 캘린더가 뜬 경우엔 블럭 2의 fold로 대체되고, **소비 내역은 비공개지만 고정지출 항목만 공개된 경우**의 폴백 표면이다.
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

친구 모드 거래 row에는 인라인 반응 카운트나 댓글 프리뷰가 없다 — 친구가 보낸 인터랙션은 DM에 모이므로 viewer는 자기가 남긴 흔적(`lastEmoji`/`lastComment` trace)만 보고, 그 외엔 DM 스레드에서 확인한다 (정책 결정 2). `lastComment` trace(말풍선 pill)는 **탭하면 행 아래 블록으로 전문이 펼쳐지고(토글)**, 펼친 블록의 「전체 대화 보기」 링크가 DM 스레드(`/dm/<owner>?message=<id>`)로 진입시킨다 — pill 자체는 더 이상 DM으로 튕기지 않는다.

**자기 거래에 달린 댓글 (owner 대시보드)**

정책 결정 2의 예외로, **owner 자기 대시보드**에서는 친구가 내 거래에 남긴 **댓글(텍스트)** 을 거래 row 아래 trace로 노출한다 — `{닉네임} · {댓글}` + `MessageCircle` 아이콘. **텍스트 영역을 탭하면 그 자리에서 전문이 펼쳐진다(truncate↔전문, 인라인 토글)** — DM으로 튕기지 않는다. DM 스레드 직행은 **항상 보이는 `[↗]`(`ArrowUpRight`) 버튼**이 담당한다(`/dm/<보낸친구>?message=<id>` 딥링크). unread(해당 DM 스레드를 마지막으로 읽은 이후 도착)면 primary로 강조 + 점, 읽은 댓글은 muted로 계속 표시한다. **unread 댓글을 펼쳐 읽으면**(인라인 열람 = DM 방문과 동치) `markIncomingCommentReadAction(messageId)`이 메시지의 thread를 해석해 `mark_dm_thread_read`(스레드 단위)를 호출해 강조가 **즉시** 해제된다 — 행 점은 낙관적으로 숨기고, 서버 계산값인 헤더 점은 `router.refresh()`로 같은 화면에서 재렌더한다. DM 스레드를 직접 방문해도 종전처럼 해제된다.

- **댓글만** 노출한다 — 이모지 반응은 owner-side trace에서 제외(요청 범위). 친구 모드 row의 카운트 부재(정책 결정 2)는 그대로 유지된다. 즉 trace는 **방향 비대칭**이다: 친구 모드엔 "내가 남긴 것", owner 모드엔 "친구가 나에게 남긴 댓글".
- 데이터는 마이그레이션 없이 기존 RLS로 충족된다. `dm_messages` SELECT(thread 멤버)가 owner를 자기 스레드 메시지에 접근시키므로 `lib/queries/interactions.ts::getIncomingInteractionsByTransaction(ownerId, txIds)`가 `quoted_transaction_id IN (내 거래) ∧ sender_id ≠ 나`로 조회하고, `dm_threads.last_read_at_user_{a,b}`로 unread를 판정한다. dashboard hot path 보호를 위해 친구가 0명이면(`hasFriends=false`) 이 쿼리 자체를 skip한다 (§3).
- 한 거래에 여러 친구가 댓글을 달면 trace는 **가장 최근 1건만** 노출한다(개수 표시 없음). 나머지는 헤더 unread 배지 합산과 DM 스레드에서 확인한다 — row를 멀티-댓글 위젯으로 키우지 않는다.
- realtime 미구독 — 서버 렌더이며 새로고침/네비게이션 시 갱신된다. 실시간 도착 통지는 푸시(아래 알림)가 담당한다.

**자기 거래 sheet**

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

#### 12.8.9 친구 그룹 (Friend Groups)

거래마다 어떤 친구가 볼 수 있는지를 **친구 그룹**으로 묶어 정한다. Instagram의 "친한 친구" 모델에서 출발해 사용자가 N개의 그룹을 만들고 친구를 분류한 뒤, 거래의 `visibility='groups'` 모드로 그 중 1개 이상을 골라 노출 범위를 제한할 수 있다. 친구 1명만 보게 하고 싶으면 그 친구 1명만 든 1인 그룹을 만들면 된다 — 거래 단위 friend 직접 화이트리스트는 의도적으로 제공하지 않는다.

**데이터 모델** (`0042_friend_groups.sql`, `0043_tvg_policy_no_recursion.sql`, `0044_friend_groups_phase2_guards.sql`)

- `friend_groups (id, owner_id, name, slug)` — owner의 그룹 행. `handle_new_user` 트리거가 가입자마다 시드 그룹 1개(`name='친한 친구'`, `slug='close'`)를 만든다. 사용자 정의 그룹은 `slug = NULL`.
- `friend_group_members (group_id, member_user_id)` — M:N. RLS INSERT 정책이 `friendships` 행 존재를 재검증한다(친구만 멤버로 추가 가능).
- `transaction_visibility_groups (transaction_id, group_id)` — M:N. `visibility='groups'` 거래의 노출 대상 그룹 링크.

**가드 (0044)**

- **slug 불변** — BEFORE UPDATE 트리거가 slug 변경을 `check_violation`으로 raise. 시드의 우회 삭제(slug를 null로 바꿔 delete RLS 통과)를 차단한다.
- **그룹 수 10개 캡** — BEFORE INSERT 트리거. 시드/backfill에는 영향 없음.
- **cascade → private** — AFTER DELETE 트리거. 그룹 삭제 후 tvg cascade로 가시성 링크가 모두 사라진 `visibility='groups'` 거래는 `visibility='private'`로 자동 전환된다(예기치 않게 전체 친구에게 공개되는 사고 차단).

RLS는 시드 그룹 삭제도 정책 단계에서 차단한다 (`friend_groups_delete_own`: `using (auth.uid() = owner_id and slug is null)`). 시드는 rename만 허용된다.

**원자 쓰기 RPC**

- `create_transaction_with_visibility(...)` / `update_transaction_with_visibility(...)` — SECURITY DEFINER. 거래 행 INSERT/UPDATE와 `transaction_visibility_groups` 링크 write를 한 트랜잭션에서 처리한다. realtime 구독자가 거래는 있는데 가시성 링크는 비어있는 부분 상태를 절대 보지 않게 한다. `transaction_visibility_groups`의 INSERT/DELETE RLS는 hard-deny 상태이므로 모든 합법적인 쓰기는 이 두 RPC를 통한다(0043 무한 재귀 회피 + 위조 방지).

**화면 — `/friends/groups`**

```txt
PageHeader
  eyebrow: ◀ 대시보드
  title:   친구 그룹

GroupList            ← 시드 우선 정렬, 그룹별 친구 수 + 첫 3명 닉네임
[+ 새 그룹 만들기]   ← 10개 캡 도달 시 disabled
```

- `<AppShell>`에 `withBottomNav` 없음 — 보조 화면.
- "+ 새 그룹 만들기" → `BottomSheet` (이름 input + `FriendMultiPicker`). 빈 그룹 생성 허용.
- 그룹 행 탭 → 편집 `BottomSheet` (이름 변경 + `FriendMultiPicker` + 저장). 시드 그룹은 rename만 허용되고 삭제 버튼은 미렌더한다.
- 사용자 정의 그룹 삭제: `previewDeleteGroupAction`으로 영향 거래 수(이 그룹이 유일 visibility group인 tx)를 조회 후 `AlertDialog`로 confirm. orphan 수가 N건이면 "{N}건이 비공개로 전환돼요" 안내를 본문에 포함한다.
- 진입점은 `<FriendOmniboxSheet>` 하단의 "그룹 관리" 링크.

**화면 — 친구 상세 (`/friends/[friendId]`)**

"그룹" 섹션에서 시드 + 사용자 정의 그룹별로 Switch 행을 보여준다. 토글 → `setGroupMembershipAction(groupId, friendId, isMember)`. 친구는 자기가 어떤 그룹에 속해 있는지 알 수 없다(자신의 멤버십을 읽을 수는 있지만 일반 사용자 surface에서는 노출하지 않는다). 그룹이 0개인 사용자에게는 "그룹 만들기" CTA를 노출한다.

**폼 통합**

- 거래 폼의 "공개 범위" 라디오 — §12.3 공개 범위 규칙 참조.
- "부분 공개" 선택 시 nested drawer로 그룹 멀티 체크박스. 각 그룹 행은 이름 + (시드면) "기본" 배지 + Users 아이콘 + 친구 수 인디케이터 + 체크 표시.
- 편집 모드에서 `transactions.visible_group_ids` 중 현재 존재하는 그룹만 selectedGroupIds로 복원한다. 사라진 그룹 id는 silently drop — 0044 cascade 트리거가 truly orphan은 이미 private으로 옮겼다.

**알림 (edge function `notify-friend-spending`)**

- `visibility='private'` 거래는 push 전송 skip.
- `visibility='groups'` 거래는 `transaction_visibility_groups`에서 link된 group_id를 조회 → `friend_group_members`에서 viewer 집합과 교집합을 구해 알림 대상을 제한한다. 그룹 멤버가 아닌 친구는 push 채널을 통해서도 거래 존재를 알 수 없다.

**캐시 정책**

§16 / §19 그대로 — friend_groups / friend_group_members / transaction_visibility_groups를 포함한 모든 친구 그룹 관련 응답은 사적 데이터로 취급하며 `NetworkOnly`로 강제한다. Cache Storage에 절대 넣지 않는다.

---

### 12.9 Stats (소비 구성 분해)

`/stats`는 "이번 사이클에 돈이 어디로 갔는가"를 카테고리/항목 단위로 분해해 보여주는 own 전용 화면이다. 대시보드가 "얼마 썼나(결과)"면 통계는 "어디에 썼나(구성)"를 맡는다. 한 화면 하나의 목적(§3.3)을 지키며, 차트가 아니라 분해 리스트로만 표현한다.

진입·범위:

- 진입점은 대시보드 합계 카드 탭 하나다 (§12.2, §11.2). 카드 하단의 「📊 소비 구성 보기 ›」 subtle 행이 진입 단서이며, 탭은 카드 전체가 받는다. 하단 탭에 추가하지 않는다 (3탭 유지, §19).
- own 모드 전용. 친구 모드(`?viewing=`)에서는 진입점을 숨긴다 — 통계는 `monthly_income` 파생값을 쓰지 않지만, 친구 소비 구성을 분해하는 surface는 §12.8 노출 범위를 벗어나므로 두지 않는다.
- 사이클·라벨은 대시보드와 동일 payday 엔진(§12.5a) 재사용. v1은 현재 사이클을 보되, **직전 사이클을 비교 기준으로 ±delta(전월比)**를 단다(스위처는 없음). 직전 사이클은 `getPreviousCycleB`(payday 엔진)로 구하며 `prevEnd === 현재 cycleStart`(연도 경계도 엔진이 처리).
- 헤더 eyebrow에 「← 대시보드」 back-link을 둔다(`/settings` 선례와 동일). own 전용이라 하단 탭이 없고 iOS PWA standalone엔 브라우저 back이 없어 나갈 경로가 필요하다 — 이 한 화면에 한해 §3.3의 "eyebrow 없음" 원칙보다 back-nav를 우선한다. 본문 상단 총액은 「{사이클} 총 소비」로 어느 사이클인지 함께 보인다.

권장 구조:

```txt
Header  ← eyebrow 「← 대시보드」 back-link · title "통계"
{사이클} 총 소비  920,000원   (변동 742,000 · 고정 178,000)

— 변동지출  742,000 —
🍔 식비   312,000   █████░░░  42%  ↑ +30,000
🛒 생활   158,000   ███░░░░░  21%  ↓ -12,000
☕ 카페    96,000   ██░░░░░░  13%
🚗 교통    64,000   █░░░░░░░   9%
    ┈┈ 결제수단 ┈┈          ← 변동 카드 안, 카테고리 행 아래 nest(분모=변동 총액)
    신용  480,000   65%
    체크  262,000   35%

— 고정지출  178,000 —   (카탈로그 그룹, 소제목 없이 아이콘으로 구분)
🏦 전세대출이자 180,820   ↑ +820
🚌 기후동행카드  55,000
🎬 OTT          48,000
☁ 클라우드      42,000
```

데이터·표시 규칙:

- 상단 총 소비 = 대시보드 `쓴 돈`(고정 effective + 변동)과 **정확히 같은 값**. 산출도 대시보드 `ownFixedExpense`(override-aware) + 변동 합을 그대로 재사용한다 — 두 화면 숫자가 어긋나면 신뢰가 깨진다.
- **변동 섹션**: `transactions`를 `category_id`로 집계. 행 = 아이콘·카테고리명·금액·CSS 막대·%. 막대·%는 변동 섹션 내 비중(자기 정규화, 합 100%). 금액 desc, 0 카테고리 숨김, `deleted_at` 제외. 직전 사이클 같은 카테고리 대비 ±delta를 단다(아래 전월比 규칙).
- **변동 카테고리 drill-down**: 변동 행을 탭하면 그 카테고리의 개별 거래를 아래로 펼친다(날짜·메모(있으면)·금액, **금액 desc** — 부모 카테고리 정렬과 같은 "큰 것부터", 동일금액은 최신순 tie-break). **exclusive accordion** — 한 번에 한 카테고리만 열리고, 새 행을 열면 이전 행이 닫힌다. 집계(카테고리로 묶기)는 그대로 두되 "그 안에 뭐가 있나"를 한 단계 확인하는 surface로, own 전용 화면이므로 거래 메모를 그대로 노출한다(친구 모드 진입점 없음). 고정 항목은 펼치지 않는다(항목 자체가 이미 최소 단위 — §12.9 비대칭). 거래 **수정/삭제는 여기서 하지 않는다** — drill-down은 읽기 전용, 편집은 대시보드의 거래 폼이 담당(surface 한 단계 유지 §19).
- **고정 섹션**: `get_fixed_effective_items(target, ym)`의 항목별 effective 금액. 행 = 아이콘(`fixed-category-icon`)·이름/`plan_name`·금액. **정렬은 카탈로그 그룹**: 같은 `category`끼리 묶고, 그룹은 그룹 합계 desc, 그룹 내 금액 desc — **소제목은 두지 않고 아이콘으로 그룹을 구분**한다(`category` 없는 직접추가는 한 그룹). 막대 없음. 직전 사이클 effective 대비 ±delta를 단다(`amount − 직전 amount`).
- **결제수단(변동 카드 안 nest)**: 변동 `transactions`를 `payment_method`(신용/체크/미지정)로 집계한 비율. 행 = 라벨·%·금액(막대 없음, 변동 섹션과 같은 미니멀). **분모는 변동지출 총액**(고정엔 결제수단이 없음)이라 신용+체크 = 변동 총액이다. 결제수단은 변동을 다시 자른 부분 슬라이스이므로 **고정지출과 동급 peer 섹션이 아니라 변동지출 카드 안에** 둔다 — 카테고리 행 아래 hairline 구분선 + 작은 「결제수단」 서브헤딩으로 종속시킨다. 카드 안에 있어 분모가 변동임이 자명하므로 별도 총액 헤딩·「변동지출 기준」 캡션은 두지 않는다(중복 총액 제거). 신용/체크가 둘 다 0이고 미지정만 있으면(전부 legacy) 블록을 숨긴다 — 쪼갤 게 없으면 노이즈다. 결제수단 컬럼 도입 전 거래는 `payment_method = null`이라 "미지정" 버킷에 모이며, 신규 거래가 쌓이면서 채워진다. 막대/도넛 차트는 두지 않는다(§19 Recharts 금지).
- 비대칭은 의도된 것 — 변동은 거래가 많아 카테고리로 묶고, 고정은 항목이 적고 각각이 정체성이라 항목별로 펼친다(은행 이자처럼 매달 바뀌는 항목을 항목 단위로 보기 위함).
- **전월比 규칙**: **변동 카테고리별·고정 항목별**에만 `이번 − 직전`을 "↑/↓ ±N"으로 표기한다(더 씀=↑ destructive(빨강), 덜 씀=↓ success(초록) — 금융 UI 관습색으로 전월比를 즉시 읽히게 하려는 선택. 이 표기에 한해 §4.3의 빨강/초록 절제 원칙보다 가독성을 우선한다). 각 섹션 헤더 아래 「↑↓ 직전 주기 대비」(변동은 「같은 때 대비」 — 진행 중 주기는 같은 경과 시점으로 잘라 비교하므로) subtle 한 줄로 기준선을 명시하되, delta가 하나라도 있을 때만 단다. **상단 총액에는 전월比 verdict("지난 주기보다 ↑ N원")를 두지 않는다** — "얼마나 늘/줄었나(추세)"는 대시보드(결과)의 일이고, /stats는 "어디에 썼나(구성)"에 집중한다(§3.3 한 화면 하나의 목적). 헤드라인 총액 전월比는 변동지출이 뒤로 몰린(back-loaded) 사이클에서 같은-시점 컷이 직전을 과하게 깎아 부풀려지는 등 단일 verdict로는 오독을 부르기 쉬워, 항목 단위 비교(이전↔현재)만 남긴다. 단 **직전 사이클에 실제 거래가 있을 때만**(`hasPrevBaseline`) 전월比를 켠다 — 고정지출은 standing 레코드라 직전 effective가 항상 존재하므로, 첫 사이클 유저에게 가짜 전월比가 뜨지 않도록 직전 거래 존재를 게이트로 둔다. 직전에 없던 신규 항목/카테고리, 안 변한 항목(delta 0)은 표기하지 않는다. 고정 항목 전월比는 직전 고정 RPC가 성공했을 때만 켠다(실패 시 prev가 0으로 읽혀 delta가 부풀려지는 것 차단).
- **같은 경과 시점 비교(변동 카테고리별 한정)**: 이번 사이클은 진행 중이라 "지금까지" 쓴 부분합인데 직전은 완료된 전체합이다 — 그대로 빼면 사이클 초반엔 항상 "덜 썼다(↓)"고 나오는 사과-오렌지 비교가 된다. 그래서 **직전 사이클 변동지출(카테고리별 비교)을 이번 사이클이 지난 경과 시간만큼만 잘라**(`cutoff = prevStart + (now − cycleStart)`) 같은 시점끼리 비교한다(`clampToElapsedWindow`). **고정지출은 자르지 않는다** — 결제일 하루에 몰린 step이라 같은 컷오프를 적용하면 직전 결제가 컷 밖으로 잘려 가짜 +증가가 뜨는 timing artifact가 생긴다(고정 항목 delta는 양쪽 전액 비교, 단 직전 amount가 null인 미기록 항목은 비교에서 제외해 가짜 +를 막는다). 이번 사이클 변동은 자르지 않는다(상단 총액이 대시보드 `쓴 돈`과 정확히 같아야 하는 불변식 보존). 상단 총액에는 전월比 verdict가 없으므로 「M/D 기준」 류 라벨도 두지 않는다.
- **전월比 한계(v1)**: 직전 effective는 과거 스냅샷이 아니라 `get_fixed_effective_items(직전 ym)`를 **지금** resolve한 값이다(직전 override 있으면 그 값, 없으면 현재 base). 매 사이클 override하는 항목(전세대출이자 등)은 정확하지만, **이번 사이클에 새로 만들면서 동시에 override한 고정 항목**은 직전 base와 비교돼 delta가 뜰 수 있다(드문 엣지 — created_at 게이트는 RPC에 없음). 정확한 스냅샷이 필요해지면 RPC에 `created_at` 게이트나 금액 이력 테이블이 필요하다.
- 빈 상태: 섹션별 graceful — 변동 0 → 변동 섹션 숨김, 고정 0 → 고정 섹션 숨김, 둘 다 0 → "이번 주기엔 아직 기록이 없어요".

surface는 한 단계까지(§19) — 섹션 구분은 카드 중첩이 아니라 구분선/라벨로 한다. Recharts·미니 그래프는 쓰지 않는다(§19, §20.9).

---

### 12.10 Savings (돈모으기)

`/savings`는 매달 모으는 돈(적금·투자·목표)을 관리한다. 고정지출이 "쓰고 사라지는 돈"이라면 돈모으기는 **"다시 내 자산이 되는 돈"**이다 — 의미가 달라 별도 탭으로 분리한다(§11.2). 데이터는 `fixed_expenses`와 별개의 `savings_plans` 테이블이며, 친구에게는 공개하지 않는다(수입·예산만큼 사적이다).

구성(위→아래, single column, `max-w-md`):

- **HERO 카드**: 라벨 「매달 모으는 돈」 + 큰 금액(검정, §3 핵심 숫자) + 「원」. 우상단 「총 N개 항목」 배지(active 개수). 보조 문구 "쓴 게 아니라 **다시 내 자산이 되는 돈**이에요"(강조부 primary). (YTD 「올해 모은 돈」 박스는 제거됨.)
- **「모으는 중」 리스트**: active 항목을 **적립일 임박순**(`comparePaymentDayUpcoming`, payment_day 없으면 월 적립액 내림차순 폴백)으로 한 리스트에 보여준다. 각 행 = 이름 + 「매월 N일」(적립일 없으면 「적립일 미정」) + 월 적립액(없으면 「금액 미입력」). 만기가 있으면 보조 라인에 「만기까지 N개월」. 목표·진행률 막대·누적(모은 돈) 표시는 없다. 고정지출 「사용 중」 리스트 미러.
- **FAB**: 오른쪽 아래 추가 버튼(대시보드 FAB와 동일 위치·primary). 적금/투자/목표 추가 BottomSheet 진입.

원칙:

- 저축은 정기 적립(적립일 `payment_day` + 월 적립액)만 기록한다. 누적 "모은 돈"·목표 진행률은 다루지 않는다(과거 잔액은 실제 계좌 몫). `goal_amount`/`opening_balance` 컬럼은 deprecated-preserve(코드 미사용, `lib/utils/savings.ts`).
- 만기 있으면 「만기까지 N개월」. (목표금액형 「목표까지 약 N개월」은 제거됨.)
- 추가·수정은 같은 `SavingsFormSheet`로 처리하고(키 `initial?.id`), 삭제는 수정 시트 안의 destructive 버튼 + AlertDialog 확인으로만 노출한다(거래 삭제 규칙과 동일, §19). 단 적금은 hard delete다(거래의 soft delete와 다름).
- 적립일 선택은 native `<select>`(`PaymentDaySelect` 재사용), 날짜는 native `<input type="date">`를 쓴다.

**대시보드 통합(Phase 2 — 완료):** 대시보드 히어로는 저축이 있으면 「나간 돈 = 모으기 + 고정 + 소비」 3분할로 바뀐다(저축은 「쓴 돈」·사용률에서 제외, 「남은 돈」에서는 차감 — §12.2). 저축 적립일은 대시보드 달력에 녹색 마커로 표시하되 그날 합계·색칠에는 더하지 않는다(own 모드 — §12.6).

**친구 노출(Phase 2b — opt-in 토글):** 저축은 기본적으로 친구에게 비공개다(수입만큼 사적). `friendships`에 `show_savings_total`·`show_savings_items`(둘 다 default false)를 두고, owner가 친구별로 켜야만 그 친구가 저축 적립 마커(items)·모으기 총액(total)을 본다 — show_fixed 패턴 미러(§12.8). `monthly_income`은 어떤 경우에도 노출하지 않는다.

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
- 소비·돈모으기·고정지출 사이는 하단 3탭으로 이동한다 (§11.2).
- 활성 고정지출 합계만 가용 예산 계산에 반영한다 (해제된 항목은 빠짐).
- 저축(돈모으기)은 「쓴 돈」·사용률에서 제외하고 「남은 돈」에서만 차감한다 — 자산이 되는 돈이다 (§12.2, §12.10).
- Pretendard를 기본 폰트로 사용한다.
- 모바일에서 먼저 좋은 화면을 만든다.

### Don't

- 홈 화면에 차트와 통계를 과하게 넣지 않는다.
- 하단 탭에 4개 이상의 항목을 넣지 않는다 (소비 / 돈모으기 / 고정지출 세 개만). 설정·통계·친구는 탭에 넣지 않는다.
- MVP에서 Recharts를 사용하지 않는다.
- 수입 내역을 transaction처럼 입력하게 만들지 않는다.
- merchant(가맹점) 필드는 넣지 않는다. **결제수단(신용/체크)은 예외로 허용**한다 — 신용/체크 비율(§12.9)과 향후 신용카드 할부 때문(§3.4·§12.3). 그 외 거래 부가 정보는 메모(선택, 100자)만 허용한다.
- private spending data를 Cache Storage에 저장하지 않는다.
- 친구의 transactions / profile / fixed_expenses / friend_groups / friend_group_members / transaction_visibility_groups / Realtime payload를 Cache Storage에 저장하지 않는다 — 친구·그룹 데이터도 NetworkOnly다.
- 친구 화면에 monthly_income / 가용 예산 / 소비율 / progress bar를 노출하지 않는다 — 가시성 토글이 어떻게 조합돼 있든 이 값들은 절대 보여주지 않는다. 사이클은 `get_user_cycle` RPC, 합계는 `get_friend_spending_total` / `get_friend_fixed_total` RPC로만 가져온다 (§12.8.3, §12.8.5).
- 합계 토글만 켜져 있는 경우 row 단위 SELECT를 노출하지 않는다 — RLS는 `items` 토글로만 게이트하고 합계는 SECURITY DEFINER RPC를 통해서만 얻는다 (§12.8.3).
- 친구의 친구에게 작성자 신상을 노출하지 않는다 — 모든 인터랙션(반응·답장)은 친구 쌍 단위 1:1 DM(`dm_messages`)으로 흐른다. 거래에 직접 반응이나 댓글을 매다는 surface(예전 `transaction_reactions` / `transaction_comments`)는 폐기되었으며 재도입하지 않는다 (§12.8.8).
- 거래 row UI에 반응 카운트 / 댓글 프리뷰를 노출하지 않는다 — 모든 인터랙션은 DM 스레드에서 확인한다. 거래 row는 카테고리 + 금액 + 메모만 표시한다 (§12.8.8).
- Apple 브랜드나 고유 UI(글래스모피즘 탭 스위처 등)를 복제하지 않는다.
- 카드 안에 카드를 중첩하지 않는다 — surface는 한 단계까지.
- 소비 삭제를 hard delete로 처리하지 않는다 — `transactions.deleted_at` 컬럼을 사용한 soft delete만 사용한다.
- 통계 화면을 하단 탭으로 만들지 않는다 — `/stats` 진입은 대시보드 합계 카드 탭 하나이며 탭은 3개(소비/돈모으기/고정지출)를 유지한다 (§11.2, §12.9).
- 친구 모드에서 통계(`/stats`) 진입점을 노출하지 않는다 — 통계는 own 전용이다 (§12.9).
- 저축을 「쓴 돈」·사용률·달력 날짜 합계에 더하지 않는다 — 적립일이 과소비(warning/danger)로 보이지 않게 한다 (§12.6, §12.10).
- 친구에게 저축을 노출하지 않는다 — `show_savings_*` opt-in 토글(기본 비공개)이 켜진 친구에게만 적립 마커·총액을 보여준다. 저축액으로 수입을 역산할 여지가 있으므로 토글은 항상 명시 동의로만 켜진다 (§12.10, Phase 2b).
- 통계 화면을 Recharts·미니 그래프로 그리지 않는다 — 분해 리스트(아이콘 + CSS 막대)로만 표현한다 (§12.9).

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
