# Floating Glass Navbar — 설계 스펙

날짜: 2026-07-20
상태: 사용자 승인 대기
관련: `DESIGN.md` §7·§8·§11.2·§12.11·§19, `components/layout/bottom-tab-nav.tsx`

## 1. 배경과 목표

최신 인스타그램 하단 네비게이션 스타일을 티끌 `BottomTabNav`에 도입한다:

- 화면 하단에서 떨어져 **떠 있는(floating) rounded pill** 형태
- **glassmorphism** 표면 (반투명 + backdrop-blur)
- **스크롤 방향 연동 morph**: 아래로 스크롤하면 라벨이 사라지고 pill 폭이 줄어 아이콘 전용 컴팩트 pill로, 위로 스크롤하면 다시 확장

### DESIGN.md 충돌 해소 (사용자 결정: 전면 채택)

현행 DESIGN.md는 이를 금지한다:

- §7 (Surfaces): "bottom navigation은 backdrop-blur + 반투명 background로 단순하게 처리한다. iOS Safari 류의 글래스모피즘은 사용하지 않는다."
- §19 (Don'ts): "Apple 브랜드나 고유 UI(글래스모피즘 탭 스위처 등)를 복제하지 않는다."

사용자 결정에 따라 **스펙을 개정**하여 floating glass pill nav를 티끌의 하우스 스타일로 승격한다. Apple **브랜드·아이콘 복제 금지**와 **4탭 원칙**(§11.2, 5개 이상 금지)은 그대로 유지한다. 개정 상세는 §9 참조.

## 2. 확정 요구사항 (사용자 응답)

| 항목 | 결정 |
|---|---|
| 스펙 충돌 처리 | 전면 채택 — DESIGN.md 개정 |
| 축소 형태 | 라벨 숨김 + pill 폭 축소 (아이콘 전용) |
| FAB 관계 | FAB 독립 유지, bottom 오프셋만 보정 |
| 전환 트리거 | 스크롤 방향 기반 (아래=축소, 위=확장, 최상단=항상 확장) |
| drawer 열림 시 | nav 상태 동결(freeze) — 스크롤 morph 비활성 |

## 3. 핵심 기술 제약

이 저장소의 검증된 교훈 (iOS PWA 실측):

1. **box-size(width/height) 애니메이션은 iOS Safari에서 60fps가 나오지 않는다.** 컴포지터에서 도는 `transform` / `opacity` / `clip-path`만 사용한다. → morph는 폭 transition이 아니라 clip-path + translate 조합으로 구현한다 (§5).
2. **iOS 키보드가 layout viewport를 스크롤시킨다.** drawer + 텍스트 입력 포커스 시 window scroll 이벤트가 발화하므로, drawer 열림 동안 스크롤 감지를 동결하지 않으면 nav가 drawer 뒤에서 오동작하고 닫은 뒤 잘못된 상태로 남는다. → freeze 메커니즘 (§6).
3. **시각 변경은 POC + 스크린샷으로 직접 검증**하고, 최종 확인은 iOS 실기기 백로그로 넘긴다 (§10).

## 4. 아키텍처

### 4.1 파일 구성

| 파일 | 작업 | 역할 |
|---|---|---|
| `components/layout/bottom-tab-nav.tsx` | 재작성 | floating glass pill + morph 렌더링 |
| `hooks/use-nav-collapsed.ts` | 신규 | 스크롤 방향 감지 → `collapsed: boolean` |
| `lib/utils/nav-freeze.ts` | 신규 | ref-count freeze 플래그 (순수 카운터 + DOM 반영) |
| `lib/utils/nav-freeze.test.ts` | 신규 | 카운터 로직 유닛 테스트 |
| `components/ui/drawer.tsx` | 수정 | 열림/닫힘 시 freeze acquire/release |
| `app/globals.css` | 수정 | `--bottom-nav-clearance` CSS 변수 + glass fallback |
| `components/layout/app-shell.tsx` | 수정 | padBottom을 CSS 변수 기반으로 |
| `components/transactions/add-transaction-button.tsx` | 수정 | FAB bottom을 CSS 변수 참조로 |
| `components/savings/savings-view.tsx` | 수정 | 〃 |
| `components/income/income-view.tsx` | 수정 | 〃 |
| `DESIGN.md` | 개정 | §7·§8·§11.2·§12.11·§19 (§9 참조) |

### 4.2 전제: 4탭 (2026-07 수입 탭 확장 반영)

nav는 소비(`/dashboard`) / 고정지출(`/fixed-expenses`) / 돈모으기(`/savings`) / 수입(`/income`) **4탭**이다 (커밋 5c41ba8). morph 수치는 전부 4아이콘 기준. 친구 모드에서 nav 자체가 숨는 구조(`withBottomNav={isOwn}`)는 불변.

### 4.3 레이아웃 상수 중앙화

nav 지오메트리를 참조하는 하드코딩 `calc(76px + env(safe-area-inset-bottom) + 16px)`이 현재 3개 파일(FAB 3곳)과 AppShell에 흩어져 있다. `app/globals.css`에 단일 소스로 선언하고 전부 이를 참조하게 바꾼다:

```css
:root {
  /* floating pill: 12px(바닥 마진) + 64px(확장 pill 높이) */
  --bottom-nav-clearance: calc(env(safe-area-inset-bottom) + 12px + 64px);
}
```

- FAB 3곳: `bottom: calc(var(--bottom-nav-clearance) + 16px)`
- AppShell `withBottomNav`: `pb-[calc(var(--bottom-nav-clearance)+24px)]`
- AppShell `withFab`: `pb-[calc(var(--bottom-nav-clearance)+16px+56px+16px)]`
- padBottom은 **확장 상태 기준 상수 고정** — 축소 시 콘텐츠 reflow 금지.
- `/income` FAB의 미래 주기 숨김 로직(bac37bc)은 위치와 무관, 불변.

## 5. Morph 스펙 (컴포지터-세이프)

DOM은 항상 **확장 상태 레이아웃**으로 렌더하고, 축소는 시각 효과로만 처리한다. 애니메이션 속성은 `transform` / `opacity` 2종뿐이다.

### 5.1 두 상태의 시각 수치

- **확장**: 폭 = rail 폭(= `min(28rem, 100vw) − 2×20px`, 최대 408px), 높이 64px, radius 32px(완전 pill). 아이콘 20px + 라벨 11px 수직 스택, 4열 균등 grid.
- **축소**: 시각 폭 ≈ 4 × 48px 슬롯 + 좌우 패딩 16px ≈ **208px**, 시각 높이 ≈ **52px**, 아이콘만 수직 중앙.

### 5.2 전환 메커니즘

축소 시 세 가지가 동시에 전환된다:

1. **컨테이너 크로스페이드**: 고정 지오메트리 glass 레이어 2장(확장형: rail 폭 × 64px radius 32px / 축소형: 208×52px 중앙 배치 rounded-full)을 `opacity`로 교차 전환한다. 각 레이어가 자기 bg·backdrop-blur·border·shadow를 온전히 소유하므로 clip-path의 "painted output 전체가 잘려 shadow/border가 사라지는" 문제가 없다. 아이콘 4개가 연속 translate로 움직이므로 컨테이너가 크로스페이드여도 morph로 읽힌다.
2. **탭 아이템 이동**: 4개 아이템 각각 `transform: translate(var(--tx-i), var(--ty))` — 바깥 2개는 크게, 안쪽 2개는 작게 중앙으로 모이고, 라벨이 사라진 만큼 아이콘이 수직 중앙으로 내려온다.
3. **라벨 페이드**: `opacity: 0`. 축소 시 120ms 선행 페이드아웃, 확장 시 ~100ms 지연 후 페이드인 (레이어 전환과 아이콘 이동이 완료된 후 라벨을 표시하기 위해).

### 5.3 오프셋 계산

rail 폭이 뷰포트에 따라 변하므로 (≤ 428px 기기) 마운트 시 + `ResizeObserver`로 **상태 전환 시가 아니라 리사이즈 시에만** JS로 계산해 CSS 변수로 주입한다. 프레임별 JS 없음.

```
railW        = nav.offsetWidth
collapsedW   = 4 × 48 + 16 = 208
expandedCx_i = (i + 0.5) / 4 × railW          // i = 0..3
collapsedCx_i= railW/2 + (i − 1.5) × 48
--tx-i       = collapsedCx_i − expandedCx_i
--ty         = (라벨 높이 + gap) / 2 ≈ 8px
```

### 5.4 transition

- `transition: opacity 260ms cubic-bezier(0.32, 0.72, 0, 1), transform 260ms 동일 이징` (vaul과 동일 계열, 비-bouncy — DESIGN.md §8 "빠르고 조용해야 한다" 준수).
- `prefers-reduced-motion: reduce` → transition 전부 제거, 상태 전환은 즉시 스냅. 기능은 동일.

## 6. 스크롤 감지 훅 + freeze

### 6.1 `use-nav-collapsed.ts`

- `window` `scroll` 리스너, `{ passive: true }` + rAF 스로틀.
- 직전 위치 대비 델타 **8px 미만은 무시** (iOS 관성/러버밴드 지터 방지).
- 아래로 이동 → `collapsed = true`, 위로 이동 → `false`.
- `scrollY < 24px` → 방향 무관 항상 확장 (러버밴드 음수 scrollY 포함).
- freeze 플래그가 서 있으면 **모든 상태 갱신 skip** (마지막 상태 유지). 해제 후 다음 스크롤 이벤트부터 자연 재개.

### 6.2 `nav-freeze.ts`

- ref-count 카운터: `acquireNavFreeze()` / `releaseNavFreeze()`. 0→1에서 `document.documentElement.dataset.navFreeze = "1"` 설정, 1→0에서 제거. 중첩 drawer(카테고리 picker 등) 안전.
- 훅은 `dataset.navFreeze` 존재 여부만 읽는다 — 이벤트 결합 없음, 순서 문제 없음.
- 카운터 로직은 순수 함수로 분리해 vitest 유닛 테스트 (`pnpm test:run` 대상).

### 6.3 acquire 지점

공유 `DrawerContent`(`components/ui/drawer.tsx`) 마운트 시 acquire, 언마운트/닫힘 시 release. 이 한 곳으로 소비 추가 폼, 카테고리 picker, `/income`의 `monthly-income-sheet`·수입 추가 drawer, `/savings` sheet 등 **모든 bottom-sheet가 자동 커버**된다 (모든 sheet는 DrawerContent 경유가 이미 하우스 룰). `AlertDialog`(삭제 확인)는 스크롤 가능 표면이 아니고 열림 중 배경 스크롤이 잠기므로 대상에서 제외한다.

## 7. Glass 표면

- 배경: `surface-glass` 토큰 (light `rgba(255,255,255,0.72)` — DESIGN.md §4에 기존 정의) + `backdrop-blur-xl`. `-webkit-backdrop-filter` 프리픽스는 Tailwind가 처리.
- 테두리: 1px `rgba(255,255,255,0.45)` 계열 하이라이트 보더 (glass 경계 정의).
- 그림자: `shadow-[0_12px_40px_rgba(0,0,0,0.14)]` 계열 soft shadow — 떠 있는 느낌.
- **fallback**: `@supports not (backdrop-filter: blur(1px))` → 불투명도 높인 배경 (`rgba(255,255,255,0.95)`). Samsung Internet 구버전 대비.
- 다크 모드 토큰(`rgba(28,28,30,0.72)`)은 이미 존재하나 앱은 현재 light 전용 — 구현은 light만, 토큰 참조는 변수 경유로 남겨둔다.
- 위치: `position: fixed; bottom: calc(env(safe-area-inset-bottom) + 12px)`, 좌우 20px 마진, `max-w-md` rail 내 중앙. z-index 40 유지 (FAB z-50 아래).

## 8. 접근성

- 축소 상태에서 라벨은 **시각적으로만** 숨김 (`opacity`) — `Link`에 `aria-label={label}` 상시 부여로 스크린리더 불변.
- 탭 타겟: 양 상태 모두 ≥ 44px (축소 슬롯 48px ≥ 44px 충족).
- `aria-current="page"` 활성 탭 표시 유지. `LinkPending`(nav-progress) 유지.
- Link hit-box는 양 상태 공통 **48px 고정 폭** (슬롯 중앙 배치, ≥44px 충족). 확장 슬롯 전체(~97px)를 hit-area로 쓰면 축소 translate 시 인접 탭과 겹쳐 오탭이 발생하므로 금지.

## 9. DESIGN.md 개정 목록

라인 번호가 아닌 섹션 기준 (2026-07 수입 탭 개정으로 라인 이동됨):

1. **§7 Surfaces**: "iOS Safari 류의 글래스모피즘은 사용하지 않는다" 문장 삭제 → floating glass pill nav 명세로 교체 (표면 토큰·blur·fallback 규칙).
2. **§8 Motion**: nav morph 전환(260ms, 컴포지터-세이프 속성 한정, reduced-motion 대응)을 허용 사례로 추가. "bouncy 금지" 원칙 불변.
3. **§11.2 Bottom Tab Navigation**: docked bar → floating pill로 서술 갱신. 스크롤 방향 morph 동작·freeze 규칙 명기. 4탭 원칙 불변.
4. **§12.11 Income**: FAB 위치 서술을 `--bottom-nav-clearance` 변수 기준으로 갱신 (§12.10 savings 동일).
5. **§19 Do/Don't**: "Apple 브랜드나 고유 UI(글래스모피즘 탭 스위처 등)를 복제하지 않는다" → "Apple 브랜드·아이콘·고유 UI를 복제하지 않는다"로 축소 (글래스모피즘 예시 삭제 — 이제 하우스 스타일). "하단 탭 5개 이상 금지" 불변.

## 10. 검증 계획

1. `pnpm test:run` — nav-freeze 카운터 유닛 테스트 + 기존 스위트 무회귀.
2. `pnpm lint`, `next build` 타입 체크.
3. **브라우저 POC 검증 루프**: in-app Browser pane(모바일 뷰포트)에서 스크롤 morph·drawer freeze·FAB 위치를 스크린샷으로 확인. 특히 축소↔확장 반복, drawer 열고 키보드 올린 뒤 닫았을 때 상태.
4. **iOS 실기기 백로그 등록**: 60fps 체감·backdrop-blur 렌더링·safe-area·러버밴드 지터는 실기기에서만 최종 확정 (기존 ios-verification-backlog 관행).

## 11. Out of Scope

- FAB의 스크롤 연동 축소/숨김 (사용자 결정으로 제외)
- 다크 모드 활성화 (토큰만 준비)
- `/settings`·`/friends`·친구 모드 대시보드 — nav 미노출 화면, 변경 없음
- Samsung Internet 실기기 검증 (iOS 우선, 백로그로)
