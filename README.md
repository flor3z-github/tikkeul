# 티끌

> 월 가용 예산 대비 소비를 한눈에 확인하는 개인용 PWA

복잡한 가계부가 아니다. 두 가지만 빠르게 본다.

1. **이번 달 총 소비 금액**
2. **월 가용 예산(`월수입 − 고정지출`) 대비 소비율**

`이번 달 690,000원 / 가용 예산 2,300,000원 중 30%` — 이 한 줄을 보려고 만든 앱.

---

## 핵심 기능

- **이메일 + 비밀번호 인증** (Supabase Auth)
- **월 수입 / 고정지출 설정** — 한 화면에서 두 값만 업서트, 라이브 검증
- **빠른 소비 추가** — 카테고리(7개 고정) + 금액 + 날짜. quick-amount 칩(`+1천`, `+5천`, `+1만`, `+5만`, `+10만`) + 되돌리기(↶) + 한 번에 지우기(×)
- **소비 수정** — 추가와 동일한 dialog 재사용 (create / edit 모드)
- **대시보드** — 이번 달 합계 + 가용 예산 대비 소비율 + 색상 분기 progress bar(정상/주의/위험/초과) + 날짜 그룹핑된 최근 5건(`오늘`/`어제`/`5월 11일`)
- **모바일 홈 화면 설치 가능 (PWA)** — Serwist 기반 manifest + service worker. 정적 리소스만 캐싱, Supabase 요청은 NetworkOnly
- **빈 상태 / 에러 / 404 / 로딩** — 디자인 시스템과 일관된 fallback

**의도적으로 제외된 것**: 오프라인 입력/동기화, 카테고리 CRUD, 거래 삭제, 메모/가맹점/결제수단, 차트, 하단 탭 네비게이션. ([DESIGN.md](./DESIGN.md) 참고)

---

## 기술 스택

| 영역 | 사용 |
|------|------|
| 프레임워크 | Next.js 16 App Router (Turbopack), React 19 |
| 언어 | TypeScript (strict) |
| 스타일 | Tailwind CSS v4, shadcn/ui (base-nova preset, neutral base color) |
| 폰트 | Pretendard Variable (dynamic subset) |
| 인증·DB | Supabase Auth + Postgres + Row Level Security |
| Supabase 클라이언트 | `@supabase/ssr` (getAll/setAll cookie API) |
| PWA | `@serwist/turbopack` + `serwist` (설치성만, 오프라인 sync 없음) |
| 알림 | sonner |
| 분석 | Vercel Web Analytics |
| 패키지 매니저 | pnpm |

---

## 로컬 셋업

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수

`.env.local.example`을 복사해서 `.env.local`을 만들고 값을 채운다.

```bash
cp .env.local.example .env.local
```

| 변수 | 설명 | 예시 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (anon key의 신형) | `sb_publishable_...` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push 공개키 (브라우저 구독용) | `B...` |
| `VAPID_PRIVATE_KEY` | Web Push 개인키 (서버 서명용, 절대 브라우저 노출 금지) | `...` |
| `VAPID_SUBJECT` | VAPID 식별 URI (운영자 연락처) | `mailto:lie9730@gmail.com` |

Supabase 값은 Supabase Dashboard → **Project Settings → API**에서 확인.

VAPID 키는 친구 소비 알림(Web Push)용. 한 번만 생성:

```bash
npx web-push generate-vapid-keys
```

출력된 `Public Key` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `Private Key` → `VAPID_PRIVATE_KEY`.
Edge Function에서도 같은 키가 필요하므로 Supabase secret으로도 등록:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=... \
  VAPID_PRIVATE_KEY=... \
  VAPID_SUBJECT=mailto:lie9730@gmail.com
```

### 3. Supabase 마이그레이션 실행

Supabase Dashboard → **SQL Editor**에서 다음을 순서대로 실행:

1. `supabase/migrations/0001_init.sql` — 스키마 + `updated_at` 트리거 + `auth.users` 가입 시 `profiles` 자동 생성
2. `supabase/migrations/0002_rls.sql` — RLS 정책 4개 테이블
3. `supabase/migrations/0003_seed_categories.sql` — 기본 카테고리 7개 (식비/카페/교통/쇼핑/생활/의료/기타) `user_id = NULL`로 공용 시드
4. `supabase/migrations/0004_remove_subscription_category.sql` — 구독 카테고리 제거(이 앱은 변동 소비만 다룸)

Authentication → **URL Configuration** → Site URL을 로컬 개발 시 `http://localhost:3000`(또는 사용 중인 포트)으로 설정. 배포 후엔 production 도메인으로 교체.

### 4. 개발 서버

```bash
pnpm dev
```

`http://localhost:3000` 접속 → `/login`으로 리다이렉트 → 가입 → `/dashboard`.

---

## 사용 가능한 명령어

| 명령 | 설명 |
|------|------|
| `pnpm dev` | Turbopack 개발 서버 |
| `pnpm build` | 프로덕션 빌드 (Service Worker도 함께 번들) |
| `pnpm start` | 빌드된 결과 서빙 |
| `pnpm lint` | ESLint |
| `pnpm gen:icons` | 단색 SVG → PWA 아이콘(192/512) + Next.js 자동 favicon(`app/icon.png`) + Apple Touch Icon 재생성 |

---

## 배포

GitHub `main`에 push하면 Vercel이 자동 재배포한다.

**Vercel 측 설정 (한 번만):**
1. https://vercel.com/new에서 repo Import
2. Framework: Next.js (자동 감지)
3. Environment Variables에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 입력
4. Deploy
5. 배포 도메인을 Supabase Dashboard → Authentication → URL Configuration → Site URL에 등록

**Web Analytics**: Vercel 프로젝트 → Analytics 탭 → Enable 한 번 클릭.

---

## 폴더 구조

```
app/
  layout.tsx              # Pretendard, Sonner, SerwistProvider, Vercel Analytics
  page.tsx                # auth 분기 후 /dashboard 또는 /login으로 redirect
  globals.css             # 디자인 토큰(light/dark CSS variables), Pretendard import
  login/, signup/         # 인증 화면 + signIn/signUp/signOut server actions
  dashboard/              # 메인 화면 + submitTransactionAction
  settings/               # 월 수입/고정지출 + saveSettingsAction
  serwist/[path]/route.ts # createSerwistRoute (SW 빌드 + 서빙)
  sw.ts                   # 서비스 워커 본체 (precache + Supabase NetworkOnly)
  manifest.ts             # PWA manifest
  serwist.tsx             # SerwistProvider client export
  opengraph-image.tsx     # 동적 OG 이미지 (1200×630)
  icon.png, apple-icon.png # Next.js 자동 wire-up 파비콘
  error.tsx, global-error.tsx, not-found.tsx, loading.tsx

components/
  layout/                 # AppShell, PageHeader
  dashboard/              # SpendingSummary, SpendingProgress, RecentTransactions
  transactions/           # TransactionFormDialog (create/edit 공용), AddTransactionButton (FAB), TransactionItem
  settings/               # SettingsForm
  ui/                     # shadcn 컴포넌트들 (button, card, input, dialog, sheet, ...)

lib/
  supabase/               # client / server / middleware Supabase 클라이언트, Database 타입
  utils.ts                # cn (shadcn)
  utils/                  # money, date(`formatRelativeKoreanDate` 포함), budget, category-icon

supabase/migrations/      # 0001~0004 SQL 마이그레이션

public/icons/             # PWA용 PNG 아이콘(manifest 참조)
scripts/gen-icons.mjs     # 아이콘 재생성 스크립트

proxy.ts                  # Next.js 16 proxy (구 middleware) — 보호 라우트 + Supabase 세션 갱신
next.config.ts            # withSerwist 래핑
```

---

## 참고

- 디자인 시스템: [DESIGN.md](./DESIGN.md)
- 라이선스: Private personal project
