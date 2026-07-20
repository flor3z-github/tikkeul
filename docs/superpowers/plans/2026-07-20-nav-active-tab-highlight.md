# 하단 탭 active 배경 하이라이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `BottomTabNav`의 active 탭에 인스타그램 스타일 배경 하이라이트(pill)를 추가한다 — 현재는 아이콘 색상 변화(`text-primary`)만 있음.

**Architecture:** 각 `Link` 안에 `absolute` 하이라이트 `<span>`을 `Icon`보다 먼저 삽입해 자연스럽게 뒤에 깔리게 하고, `Link` 중심(`left-1/2 top-1/2` + translate)에 고정 배치한다. 크기는 확장/축소 상태별 고정 상수 2쌍(라벨 길이와 무관, 4탭 공통)이며 `active` 여부에 따라 opacity만 크로스페이드한다. `Link`가 이미 스크롤-collapse용 `transform: translate(...)`를 갖고 있으므로 하이라이트는 그 좌표계를 그대로 상속받아 별도 위치 계산이 필요 없다.

**Tech Stack:** Next.js 16 / React 19 / Tailwind v4 (CSS-first)

**Spec:** `docs/superpowers/specs/2026-07-20-nav-active-tab-highlight-design.md`

## Global Constraints

- iOS Safari PWA가 1차 타겟 — box-size(width/height) **transition 금지**, 애니메이션은 `transform`/`opacity`만 (스펙 §3-1, 저장소 컨벤션).
- 하이라이트 폭·높이는 **상태별(확장/축소) 고정 상수** — 라벨 길이별 hug 아님, 4탭 공통값 (스펙 §3.3, 2026-07-20 사용자 결정으로 확정).
- 색은 `bg-primary/10`, radius는 `rounded-full`(`DESIGN.md` §7.2 chip 토큰 9999px). 기존 아이콘 `text-primary`/라벨 `text-foreground` 색 로직은 불변(이중 신호).
- `prefers-reduced-motion: reduce` → transition 제거, 즉시 스냅 (기존 파일 전체 컨벤션 `motion-reduce:transition-none`).
- 탭은 4개 고정, 라우트/아이콘/라벨 변경 없음.
- import는 `@/*` 경로 별칭.
- 이 저장소는 컴포넌트 테스트 스위트가 없다(순수 `lib/utils` vitest만) — 검증은 `pnpm lint` + `pnpm build`(타입체크) + 브라우저 POC.
- 커밋은 태스크 단위.

---

### Task 1: BottomTabNav에 active 하이라이트 추가

**Files:**
- Modify: `components/layout/bottom-tab-nav.tsx:28-32`(상수), `:116-158`(Link 블록)

**Interfaces:**
- 이 컴포넌트는 export 인터페이스 변경 없음 (`BottomTabNav()`만 export, props 없음). 내부 전용 상수 3개 추가.

- [ ] **Step 1: 하이라이트 크기 상수 추가**

`components/layout/bottom-tab-nav.tsx` 32행(`const COLLAPSED_TY = 8;` 바로 아래)에 추가:

```ts
// Active-tab highlight pill. Fixed per state, NOT per-label-length — width/
// height are identical across all 4 tabs regardless of "소비" (2 chars) vs
// "고정지출" (4 chars). Values are POC-tuned starting points (Pretendard
// 11px label + 20px icon), not exact hugs.
const HIGHLIGHT_COLLAPSED_SIZE = 36; // circle, collapsed pill (icon only)
const HIGHLIGHT_EXPANDED_W = 64; // pill width, expanded (icon+label stack)
const HIGHLIGHT_EXPANDED_H = 48; // pill height, expanded
```

- [ ] **Step 2: `Link`에 `relative` 추가 + 하이라이트 `span` 삽입**

현재 116–158행:

```tsx
              <Link
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                  // Fixed 48px hit-box in BOTH states (≥44px, spec §8):
                  // full-slot-width links would overlap once translated.
                  "flex w-12 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  "transition-transform motion-reduce:transition-none",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                style={{
                  transform: collapsed
                    ? `translate(var(--tx-${i}), ${COLLAPSED_TY}px)`
                    : "translate(0px, 0px)",
                  transitionDuration: DURATION,
                  transitionTimingFunction: EASE,
                }}
              >
                <Icon
                  className={cn(
                    "size-5 shrink-0",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "transition-opacity motion-reduce:transition-none",
                    // Fade the label out fast ahead of the shape change, and
                    // back in slightly late so text never overlaps the
                    // collapsed pill boundary (spec §5.2-3).
                    collapsed
                      ? "opacity-0 duration-[120ms]"
                      : "opacity-100 delay-100 duration-150",
                  )}
                >
                  {label}
                </span>
                <LinkPending />
              </Link>
```

교체:

```tsx
              <Link
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                  // Fixed 48px hit-box in BOTH states (≥44px, spec §8):
                  // full-slot-width links would overlap once translated.
                  // relative: anchors the active-highlight span below.
                  "relative flex w-12 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  "transition-transform motion-reduce:transition-none",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                style={{
                  transform: collapsed
                    ? `translate(var(--tx-${i}), ${COLLAPSED_TY}px)`
                    : "translate(0px, 0px)",
                  transitionDuration: DURATION,
                  transitionTimingFunction: EASE,
                }}
              >
                {/* Active-tab background pill. Rendered before Icon/label so
                    it paints behind them (DOM order = stacking order, no
                    z-index needed). Centered on the Link's own box — width/
                    height are fixed per collapsed state (spec §3.3), never
                    per-label, so no content measurement is required. Only
                    opacity is transitioned; width/height snap instantly with
                    the collapse morph (box-size transition ban, spec §3-1).
                    pointer-events-none so it never steals taps even where it
                    visually overflows the 48px hit-box into slot padding. */}
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10",
                    "transition-opacity motion-reduce:transition-none",
                  )}
                  style={{
                    width: collapsed ? HIGHLIGHT_COLLAPSED_SIZE : HIGHLIGHT_EXPANDED_W,
                    height: collapsed ? HIGHLIGHT_COLLAPSED_SIZE : HIGHLIGHT_EXPANDED_H,
                    opacity: active ? 1 : 0,
                    transitionDuration: DURATION,
                    transitionTimingFunction: EASE,
                  }}
                />
                <Icon
                  className={cn(
                    "size-5 shrink-0",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "transition-opacity motion-reduce:transition-none",
                    // Fade the label out fast ahead of the shape change, and
                    // back in slightly late so text never overlaps the
                    // collapsed pill boundary (spec §5.2-3).
                    collapsed
                      ? "opacity-0 duration-[120ms]"
                      : "opacity-100 delay-100 duration-150",
                  )}
                >
                  {label}
                </span>
                <LinkPending />
              </Link>
```

- [ ] **Step 3: lint·빌드 확인**

Run: `pnpm lint && pnpm build`
Expected: PASS. (컴포넌트 테스트 스위트 없음 — 이 파일은 `lib/utils`를 참조하지 않으므로 `pnpm test:run` 영향 없음.)

- [ ] **Step 4: Commit**

```bash
git add components/layout/bottom-tab-nav.tsx
git commit -m "feat(nav): active 탭에 배경 하이라이트 pill 추가 — 라벨 길이 무관 고정폭, opacity 크로스페이드"
```

---

### Task 2: DESIGN.md §11.2 개정

**Files:**
- Modify: `DESIGN.md:619`

- [ ] **Step 1: 활성 탭 문장 교체**

현재 619행:

```
- 활성 탭은 아이콘에 primary 색을 적용하고 라벨은 foreground로, 비활성 탭은 muted-foreground로 표시한다. 돈모으기 탭 아이콘은 새싹(`Sprout`), 수입 탭 아이콘은 손모으기(`HandCoins`)다.
```

교체:

```
- 활성 탭은 아이콘에 primary 색을 적용하고 라벨은 foreground로, 비활성 탭은 muted-foreground로 표시한다. 추가로 활성 탭 아이콘(확장 상태에서는 라벨까지)을 감싸는 `bg-primary/10` 배경 pill이 opacity 크로스페이드로 나타난다 — radius는 §7.2 chip 토큰(9999px), 폭·높이는 라벨 길이와 무관하게 상태별(확장/축소) 4탭 공통 고정값이며 슬라이딩 없이 탭별 독립 페이드다. 돈모으기 탭 아이콘은 새싹(`Sprout`), 수입 탭 아이콘은 손모으기(`HandCoins`)다.
```

- [ ] **Step 2: Commit**

```bash
git add DESIGN.md
git commit -m "docs(nav): DESIGN.md §11.2 개정 — active 탭 배경 하이라이트 pill 명세 추가"
```

---

### Task 3: 브라우저 POC 검증 루프

**Files:** 코드 변경은 발견된 결함 수정에 한정 (주로 `HIGHLIGHT_*` 상수 튜닝, `components/layout/bottom-tab-nav.tsx`).

- [ ] **Step 1: 정적 검증**

Run: `pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 2: 브라우저 검증 루프**

in-app Browser pane에서 dev 서버(`.claude/launch.json` 경유) + 모바일 뷰포트(375×812)로:

1. `/dashboard` 로그인 상태, 확장 nav — 소비 탭 하이라이트 렌더 확인(pill 크기·위치·색 틴트), 스크린샷.
2. `/fixed-expenses`·`/savings`·`/income`으로 순서대로 이동 — 매번 새 탭에만 하이라이트가 즉시 켜지고 이전 탭은 즉시 꺼지는지(슬라이딩 없음), 스크린샷 1장.
3. 아래로 스크롤 → 축소 morph — active 탭 하이라이트가 원형으로 스냅(width/height 즉시 전환, opacity는 그대로 유지)되는지, 다른 아이콘들과 겹치거나 인접 슬롯을 침범하지 않는지 확인.
4. 위로 스크롤 → 재확장 시 하이라이트가 다시 pill로 스냅되는지.
5. 짧은 라벨("소비"/"수입")과 긴 라벨("고정지출"/"돈모으기") 탭에서 고정폭 pill이 라벨을 완전히 감싸는지(라벨이 pill 밖으로 삐져나오면 `HIGHLIGHT_EXPANDED_W` 상향 조정) — 육안 확인, 필요시 상수 수정.
6. 다크 모드(뷰포트 `colorScheme: "dark"`)에서 `bg-primary/10` 대비 확인.
7. 콘솔 에러 0건 확인 (`read_console_messages`).

- [ ] **Step 3: 발견 결함/상수 조정 → Step 1부터 재실행**

- [ ] **Step 4: iOS 실기기 백로그 등록**

메모리 `ios-verification-backlog`에 추가: "하단 탭 active 배경 하이라이트 — 스크롤 축소/확장 시 pill↔원형 스냅 체감(버벅임 없는지), 다크모드 대비, 실기기 확인 필요".

- [ ] **Step 5: 최종 커밋 (수정분 있을 때만)**

```bash
git add -A && git commit -m "fix(nav): 하이라이트 POC 검증 루프에서 발견된 상수/결함 수정"
```
