# 하단 탭 active 배경 하이라이트 — 설계 스펙

날짜: 2026-07-20
상태: 사용자 승인 대기
관련: `DESIGN.md` §7.2·§8·§11.2, `components/layout/bottom-tab-nav.tsx`, `docs/superpowers/specs/2026-07-20-floating-glass-navbar-design.md`(직전 nav 재작성)

## 1. 배경과 목표

인스타그램 하단 nav는 선택된 탭 아이콘 뒤에 배경 하이라이트(pill)가 깔린다. 티끌 `BottomTabNav`는 현재 색상 변화만 준다 — `DESIGN.md` §11.2: "활성 탭은 아이콘에 primary 색을 적용하고 라벨은 foreground로, 비활성 탭은 muted-foreground로 표시한다." 이 문장을 개정해 active 탭 배경 하이라이트를 추가한다.

`bottom-tab-nav.tsx`는 5커밋 전 twin-layer glass pill(확장 rail ↔ 축소 컴팩트 pill, 스크롤 방향 연동 morph)로 막 재작성됨(`2026-07-20-floating-glass-navbar-design.md`). 이번 작업은 그 위에 얹는 추가 레이어이지 재작성이 아니다.

## 2. 확정 요구사항 (사용자 응답)

| 항목 | 결정 |
|---|---|
| 적용 상태 | 확장(라벨 보임) + 축소(아이콘만 남는 컴팩트 pill) 둘 다 |
| 모양 | **확장: 레일 안에 사방 균일 inset(8px)으로 떠 있는 스타디움 pill** — 폭 = 슬롯(레일/4) − 16px, 높이 = 64 − 16 = 48px, `rounded-full`(radius 24 = 레일 32 − inset → 코너 동심). 2026-07-20 3차 결정: 인스타그램과 나란히 비교 후 flush 세그먼트 필(2차)·64×48 중앙 pill(1차) 대체. 축소 상태는 아이콘만 감싸는 36px 원형. 라벨별 hug 아님 |
| 모션 | 탭별 독립 opacity 크로스페이드. 공유 요소가 탭 사이를 슬라이딩하지 않음 |
| 색 | `bg-primary/10` 틴트. 아이콘 `text-primary` 색은 기존대로 유지(이중 신호) |

### 슬라이딩을 채택하지 않은 이유

라벨 길이가 탭마다 다르다("소비" vs "고정지출"). 진짜 슬라이딩 pill을 만들려면 폭도 함께 애니메이션해야 하는데, 이 repo는 iOS 실측 교훈으로 **box-size(width/height) transition을 금지**하고 transform/opacity만 쓴다(`floating-glass-navbar-design.md` §3-1, 기존 코드의 라벨 fade·collapse translate 전부 이 원칙을 따름). 폭 고정 슬라이딩(가장 긴 라벨 기준 통일 폭)이라는 대안도 있었으나, 탭별 독립 fade가 코드가 가장 작고 기존 twin-layer opacity 패턴을 그대로 재사용할 수 있어 채택. 실제 인스타그램도 라우트 전환이라 슬라이드가 아니라 즉시 on/off다.

## 3. 아키텍처

### 3.1 파일 구성

| 파일 | 작업 |
|---|---|
| `components/layout/bottom-tab-nav.tsx` | 수정 — `Link` 내부에 하이라이트 요소 추가 |
| `DESIGN.md` | 개정 — §11.2 active 탭 문장에 배경 하이라이트 조항 추가 |

새 파일 없음. 훅/유틸 추가 없음.

### 3.2 DOM 구조 변경

현재 `Link` 자식은 `Icon` → `span`(라벨) → `LinkPending` 순서다. `Link`에 `relative`를 추가하고, `Icon` 앞에 하이라이트 `span`을 하나 삽입한다:

```
<Link className="relative ..." style={translate ...}>   ← relative 추가, 기존 collapse translate 그대로 유지
  <span aria-hidden                                       ← 신규 하이라이트, -z-10으로 Icon/라벨 뒤에 깔림
    className="pointer-events-none absolute left-1/2 top-1/2 -z-10
                rounded-full bg-primary/10 transition-opacity motion-reduce:transition-none"
    style={{
      transform: collapsed ? `translate(-50%, calc(-50% + ${HIGHLIGHT_COLLAPSED_TY}px))`
                           : "translate(-50%, -50%)",
      width: collapsed ? HIGHLIGHT_COLLAPSED_SIZE
                       : `calc(var(--slot-w, calc((100vw - 40px) / 4)) - ${HIGHLIGHT_INSET * 2}px)`,
      height: collapsed ? HIGHLIGHT_COLLAPSED_SIZE : HIGHLIGHT_EXPANDED_H,
      opacity: active ? 1 : 0,
      transitionDuration: DURATION,
      transitionTimingFunction: EASE,
    }} />
  <Icon .../>
  <span>{label}</span>                                    ← 기존 라벨, opacity fade 로직 불변
  <LinkPending />
</Link>
```

`left-1/2 top-1/2 -translate-x/y-1/2`로 `Link` 중심에 고정 배치 — 라벨 길이와 무관하게 4탭 동일 위치·크기. DOM상 `Icon`/라벨보다 먼저 나오므로 별도 `z-index` 없이 뒤에 깔린다(stacking order). `Link` 자신의 collapse-translate를 그대로 상속하므로 위치 계산 코드를 추가로 두지 않는다. `pointer-events-none`은 collapsed 상태에서 인접 컬럼 여백까지 하이라이트가 넘칠 때 클릭을 가로채지 않기 위한 방어(기존 nav-level glass 레이어와 동일 컨벤션).

### 3.3 크기 — 레일 안 균일 inset 스타디움 pill (2026-07-20 3차 결정, 인스타그램 비교 후)

결정 이력: 1차 = 4탭 공통 고정 상수 64×48 중앙 pill → 2차(실기기 확인 후) = 슬롯 전체 flush 세그먼트 필 → **3차(인스타그램 스크린샷과 나란히 비교 후, 최종) = 레일 안에 사방 균일 inset으로 떠 있는 스타디움 pill**. 인스타그램 구조의 요점은 하이라이트가 레일 경계와 분리된 독립 pill이라는 것 — flush 세그먼트가 아니라 사방 갭이 균일해야 한다. 라벨별 hug는 여전히 아님(4탭 리듬 동일 원칙 유지).

```ts
const HIGHLIGHT_INSET = 8;                               // 레일 경계에서 사방 여백
const HIGHLIGHT_EXPANDED_H = 64 - HIGHLIGHT_INSET * 2;   // 48 — 레일 h-16(64px)과 동기
const HIGHLIGHT_COLLAPSED_SIZE = 36;                     // 원형, 축소 pill의 아이콘 전용
```

- 확장 폭 = `슬롯 폭 − 2×inset`. 슬롯 폭은 기존 collapse-translate용 ResizeObserver가 이미 레일 폭을 재고 있으므로 같은 자리에서 `--slot-w`(= `railW / 4` px) CSS 변수로 내려준다. 마운트 첫 프레임(변수 미설정) 폴백은 `calc((100vw - 40px) / 4)` — `inset-x-5` 레일과 폰 뷰포트에선 정확히 일치, 데스크톱 광폭에서만 잠깐 과대했다가 observer가 즉시 교정. 첫/마지막 탭은 레일 끝에서 8px, 인접 탭 하이라이트끼리는 슬롯 경계 기준 8px+8px 갭.
- 확장 높이 = 48px (레일 64 − 상하 8px씩).
- **축소 상태 세로 보정 `HIGHLIGHT_COLLAPSED_TY = -10`**: 라벨은 opacity로만 사라지고 레이아웃엔 남으므로 아이콘이 Link 박스 중심보다 (라벨 line-height 16.5 + gap 4)/2 ≈ 10px 위에 있다. 하이라이트를 Link 중심에 그대로 두면 원이 아이콘 아래로 처짐(2026-07-20 실기기 발견) — 축소 상태에서만 translate로 −10px 올려 아이콘 중심에 맞춘다. 확장 상태는 아이콘+라벨 스택 전체가 대상이라 Link 중심 그대로가 맞음.

크기 값 자체엔 `transition`을 걸지 않는다(§3-1의 box-size transition 금지 원칙) — `collapsed` boolean에 따라 즉시 스냅. active 탭이 스크롤 축소 모프를 통과하는 순간 하이라이트 크기가 한 프레임에 바뀐다(애니메이션 없이, opacity만 페이드). 탭을 그냥 탭(클릭)할 때는 collapsed 상태가 안 바뀌므로 스냅 자체가 없다.

### 3.4 색·라운드

- 배경: `bg-primary/10` (라이트/다크 공용 — `--primary` 토큰이 이미 다크모드 변수를 가지므로 별도 다크 분기 불필요)
- radius: `rounded-full` — 확장 상태에서 radius = 높이/2 = 24px = **레일 radius(32) − inset(8)**, 즉 레일 끝 코너에서 갭이 균일하게 도는 동심(concentric) 구조가 자동으로 나온다(인스타그램과 동일 기하). 축소 36px에선 자연히 18px 원. 레일 곡률이나 inset을 바꾸면 이 동심 관계(`레일 radius − inset = 높이/2`)를 유지할 것
- 기존 아이콘 `text-primary` / 라벨 `text-foreground` 색 로직은 변경 없음(이중 신호 유지)

### 3.5 motion-reduce / 접근성

- 하이라이트 opacity transition에도 기존 코드 전반의 `motion-reduce:transition-none` 패턴을 동일 적용
- `aria-hidden` — 스크린리더에 노출되는 정보 아님(active 상태는 이미 `aria-current="page"`로 전달됨)
- hit-box(48px, `w-12`)는 `Link`에 그대로 유지 — 하이라이트가 시각적으로 넘쳐도 탭 영역은 안 바뀜

## 4. DESIGN.md 개정

§11.2 아래 문장:

> 활성 탭은 아이콘에 primary 색을 적용하고 라벨은 foreground로, 비활성 탭은 muted-foreground로 표시한다.

다음으로 교체:

> 활성 탭은 아이콘에 primary 색을 적용하고 라벨은 foreground로, 비활성 탭은 muted-foreground로 표시한다. 추가로 활성 탭에는 `bg-primary/10` 배경 하이라이트가 opacity 크로스페이드로 나타난다 — 확장 상태에선 탭 슬롯 전체(폭 25%·레일 높이·레일과 동일한 32px 곡률)를 채우는 세그먼트 필, 축소 상태에선 아이콘을 감싸는 36px 원. 폭은 라벨 길이와 무관하며, 슬라이딩 없이 탭별 독립 페이드다.

## 5. 검증 계획

- 순수 UI 변경, `lib/utils/*` 테스트 대상 아님 — `pnpm test:run` 영향 없음(회귀 확인만)
- 브라우저 프리뷰(POC)로 1차 확인: 4탭 각각 active 전환 시 하이라이트 페이드, 확장↔축소 스크롤 모프 시 하이라이트 동작(§3.3 스냅 체감 포함), 다크 모드
- iOS Safari PWA 실기기 최종 확인은 사람 몫(이 repo 컨벤션) — 완료 후 `ios-verification-backlog` 메모리에 항목 추가

## 6. 스코프 제외

- 슬라이딩 인디케이터(§2 모션 결정에서 제외)
- 라벨별 hug 폭 측정(§3.3에서 폐기 — 고정값으로 대체)
