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
| 모양 | 아이콘+라벨을 감싸는 pill (확장 상태). 축소 상태는 라벨이 opacity-0이라 결과적으로 아이콘만 감싸는 형태가 됨 |
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

현재 `Link` 자식은 `Icon` → `span`(라벨) → `LinkPending` 순서다. 여기에 `Icon`+라벨을 감싸는 wrapper와, 그 뒤에 깔리는 하이라이트 `span`을 추가한다:

```
<Link style={translate ...}>          ← 기존 collapse translate 그대로 유지
  <span className="relative inline-flex flex-col items-center">  ← 신규 wrapper, w-fit
    <span aria-hidden                                             ← 신규 하이라이트
      className="absolute -inset-x-3 -inset-y-1.5 rounded-full bg-primary/10
                  transition-opacity motion-reduce:transition-none"
      style={{ opacity: active ? 1 : 0, transitionDuration: DURATION }} />
    <Icon .../>
    <span>{label}</span>                                          ← 기존 라벨, opacity fade 로직 불변
  </span>
  <LinkPending />
</Link>
```

하이라이트는 wrapper의 형제이자 DOM상 다른 자식보다 먼저 나오므로 별도 `z-index` 없이 자연스럽게 아이콘/라벨 뒤에 깔린다(stacking order). wrapper가 `Link`의 collapse-translate를 상속하므로 위치 계산 코드를 추가로 두지 않는다.

### 3.3 폭(width) 처리 — 알려진 트레이드오프

확장 상태에서는 아이콘+라벨 폭을, 축소 상태에서는 아이콘 폭만 감싸야 한다. 문제: 라벨은 축소 시 `opacity-0`으로 숨지만 **레이아웃 폭은 그대로 차지한다**(opacity는 크기에 영향 없음). 즉 하이라이트가 감싸는 실제 콘텐츠 폭이 확장↔축소 전환 순간 바뀐다.

이 폭 값 자체에 `transition`을 걸지 않는다(§3-1의 box-size transition 금지 원칙). 대신 `collapsed` boolean에 따라 즉시 스냅 처리한다 — active 탭이 스크롤 축소 모프를 통과하는 그 순간, 하이라이트 폭이 한 프레임에 바뀐다(애니메이션 없이). 정확한 hug 폭을 얻는 방법은 구현 단계에서 아래 중 선택:

- (a) 기존 rail-width `useEffect`(ResizeObserver, `--tx-i` 계산)를 확장해 각 탭 wrapper의 `scrollWidth`도 함께 측정, `--pw-i` CSS 변수로 노출
- (b) 상태별 고정 padding 근사(`-inset-x-3` 축소/확장 공통값으로 시각적으로 충분히 자연스러운지 먼저 POC로 확인 후 결정)

**영향 범위**: 이 스냅은 activie 탭이 스크롤로 축소/확장을 가로지르는 순간에만 보임 — 탭을 그냥 탭(클릭)할 때는 collapsed 상태가 안 바뀌므로 폭 스냅 없이 opacity 페이드만 일어난다. 실사용 임팩트는 작을 것으로 예상하나 POC로 확인한다(§5).

### 3.4 색·라운드

- 배경: `bg-primary/10` (라이트/다크 공용 — `--primary` 토큰이 이미 다크모드 변수를 가지므로 별도 다크 분기 불필요)
- radius: `rounded-full` (`DESIGN.md` §7.2 `chip: 9999px` 토큰과 동일 반경 재사용 — 하이라이트는 개념적으로 chip에 가까움)
- 기존 아이콘 `text-primary` / 라벨 `text-foreground` 색 로직은 변경 없음(이중 신호 유지)

### 3.5 motion-reduce / 접근성

- 하이라이트 opacity transition에도 기존 코드 전반의 `motion-reduce:transition-none` 패턴을 동일 적용
- `aria-hidden` — 스크린리더에 노출되는 정보 아님(active 상태는 이미 `aria-current="page"`로 전달됨)
- hit-box(48px, `w-12`)는 `Link`에 그대로 유지 — 하이라이트가 시각적으로 넘쳐도 탭 영역은 안 바뀜

## 4. DESIGN.md 개정

§11.2 아래 문장:

> 활성 탭은 아이콘에 primary 색을 적용하고 라벨은 foreground로, 비활성 탭은 muted-foreground로 표시한다.

다음으로 교체:

> 활성 탭은 아이콘에 primary 색을 적용하고 라벨은 foreground로, 비활성 탭은 muted-foreground로 표시한다. 추가로 활성 탭 아이콘(+확장 상태에서는 라벨까지)을 감싸는 `bg-primary/10` 배경 pill이 opacity 크로스페이드로 나타난다(radius는 §7.2 chip 토큰) — 슬라이딩 없이 탭별 독립 페이드다.

## 5. 검증 계획

- 순수 UI 변경, `lib/utils/*` 테스트 대상 아님 — `pnpm test:run` 영향 없음(회귀 확인만)
- 브라우저 프리뷰(POC)로 1차 확인: 4탭 각각 active 전환 시 하이라이트 페이드, 확장↔축소 스크롤 모프 시 하이라이트 동작(§3.3 스냅 체감 포함), 다크 모드
- iOS Safari PWA 실기기 최종 확인은 사람 몫(이 repo 컨벤션) — 완료 후 `ios-verification-backlog` 메모리에 항목 추가

## 6. 스코프 제외

- 슬라이딩 인디케이터(§2 모션 결정에서 제외)
- 축소 pill 내부의 하이라이트 폭 실측 정밀화(3.3의 (a)/(b) 선택은 구현 계획 단계로 위임)
