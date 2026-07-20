# /stats 변동지출 개별 거래 정렬 (날짜순/금액순) — 설계

날짜: 2026-07-20 · 승인: 경만님

## 목적

/stats 변동지출 섹션에서 카테고리 행을 펼쳤을 때 나오는 개별 거래 목록을
사용자가 날짜순/금액순으로 전환해 볼 수 있게 한다. 현재는 날짜 최신순 고정.

## 범위

- **대상**: 펼친 개별 거래 목록만 (`VariableRow`의 drill-down 패널).
- **불변**: 카테고리 집계 행 순서(금액 큰 순), 고정지출 섹션, 결제수단 nested 블록,
  서버/DB/쿼리 전부 변경 없음.

## 동작

- 토글은 **변동지출 섹션 헤더에 전역 하나** — 어느 카테고리를 펼쳐도 같은 정렬 적용.
  (exclusive accordion이라 전역=개별 체감 동일.)
- **날짜순** = 최신순 (기본값, 현행과 동일).
- **금액순** = 큰 금액순, 동액이면 최신 먼저.
- 오름/내림 뒤집기 없음 (YAGNI). 상태는 세션 내 메모리만 — localStorage 저장 안 함
  (정렬은 탐색용 일시 상태).

## UI

`SectionHeading` 아래·`SectionListCard` 위에 텍스트 버튼 2개(「날짜순」 「금액순」),
선택된 쪽 강조(글자색/굵기). 새 shadcn 컴포넌트 없음. `aria-pressed`로 선택 상태 표기.

## 구현

| 파일 | 변경 |
|---|---|
| `lib/utils/stats/cycle-breakdown.ts` | 순수 함수 `sortVariableItems(items, mode)` 추가. `mode: "date" \| "amount"`. date = spentAt ISO desc → id tie-break, amount = amount desc → spentAt desc. 입력 불변(복사 후 정렬). |
| `lib/utils/stats/cycle-breakdown.test.ts` | 테스트 먼저 (regression pin): date 최신순, amount 큰순, 동액 tie-break, 원본 비변형. |
| `components/stats/variable-section.tsx` | `VariableSection`에 `useState<SortMode>("date")` + 헤더 하단 토글. `VariableRow`에 `sortMode` prop 전달, 펼친 패널에서 `sortVariableItems` 적용. |

## 테스트 전략

`pnpm test:run` (util 테스트). 정렬은 ISO 문자열 비교라 TZ 무관이지만 규칙대로
`pnpm test:utc`도 통과 확인. UI는 util 테스트로 못 보므로 iOS Safari PWA 시각
확인은 별도(사람).

## 에러 처리

없음 — 순수 클라이언트 정렬, 실패 경로 없음. 빈 items는 그대로 빈 목록.
