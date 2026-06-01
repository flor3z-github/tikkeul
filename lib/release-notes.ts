// User-facing release notes for the in-app "새 소식" surfaces.
//
// Two consumers (see plan): a settings "새 소식" entry that lists the full
// history, and a one-time bottom sheet on the own-mode dashboard that shows the
// latest release once per version bump (keyed on localStorage vs
// LATEST_RELEASE_VERSION). Keep RELEASE_NOTES ordered newest-first.
//
// Copy is user-friendly Korean ("이제 ~할 수 있어요"). Dev-internal changes
// (build/test/infra) are intentionally omitted — only user-visible changes go
// here.

export type ReleaseItemType = "feature" | "improve" | "design" | "fix";

export type ReleaseItem = {
  type: ReleaseItemType;
  text: string;
};

export type ReleaseNote = {
  version: string;
  /** Release date as YYYY-MM-DD (KST). */
  date: string;
  title: string;
  /** Optional one-line lead shown under the title. */
  summary?: string;
  items: ReleaseItem[];
};

/** Tag-chip labels for each item type. UI decides chip color/variant. */
export const RELEASE_ITEM_TYPE_LABEL: Record<ReleaseItemType, string> = {
  feature: "새 기능",
  improve: "개선",
  design: "디자인",
  fix: "수정",
};

/** Newest first. The first entry is the "latest" shown in the one-time sheet. */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.8.0",
    date: "2026-06-01",
    title: "더 똑똑해진 예산 주기",
    items: [
      {
        type: "feature",
        text: '예산 주기를 "돈 들어오는 날" 하나만 고르면 되도록 새로 만들었어요. 급여 규정(이전·당일·다음 영업일)도 고를 수 있어요.',
      },
      {
        type: "feature",
        text: "공휴일과 주말을 반영해서 실제 입금일을 자동으로 계산해드려요.",
      },
      {
        type: "improve",
        text: "앱을 처음 열 때 더 빨리 켜지도록 다듬고, iOS 스플래시 화면을 추가했어요.",
      },
      {
        type: "fix",
        text: "알림을 눌렀을 때 해당 거래·DM으로 정확히 이동하도록 고쳤어요.",
      },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-05-27",
    title: "나만의 카테고리",
    items: [
      {
        type: "feature",
        text: "이제 나만의 카테고리를 직접 만들고, 수정·삭제할 수 있어요.",
      },
      {
        type: "feature",
        text: "친구가 내 소비에 단 댓글을 대시보드에서 바로 확인할 수 있어요.",
      },
      {
        type: "fix",
        text: "메모·댓글을 쓸 때 iOS 키보드가 입력칸을 가리던 문제를 고쳤어요.",
      },
      {
        type: "fix",
        text: "가끔 알림이 오지 않던 문제를 해결했어요.",
      },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-05-21",
    title: "친구 그룹과 추가 수입",
    items: [
      {
        type: "feature",
        text: "친한 친구 그룹을 만들고, 거래마다 누구에게 보여줄지 정할 수 있어요.",
      },
      {
        type: "feature",
        text: "이제 추가 수입도 기록할 수 있어요. (+ 버튼을 길게 누르면 빠르게 열려요)",
      },
      {
        type: "feature",
        text: "메모로 지난 소비를 검색할 수 있게 됐어요.",
      },
      {
        type: "design",
        text: "카테고리 아이콘에 색을 입혀 더 알아보기 쉬워졌어요.",
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-05-19",
    title: "알림, DM, 그리고 설치 안내",
    items: [
      {
        type: "feature",
        text: "친구가 소비를 기록하면 알림으로 받아볼 수 있어요.",
      },
      {
        type: "feature",
        text: "친구와 1:1 DM을 주고받고, 소비에 이모지·댓글로 반응할 수 있어요.",
      },
      {
        type: "feature",
        text: "홈 화면에 앱을 추가하는 방법을 안내해드려요. (iOS 가이드 포함)",
      },
      {
        type: "improve",
        text: "카테고리를 12종으로 더 세분화했어요.",
      },
      {
        type: "feature",
        text: "고정지출에 결제일을 넣으면 캘린더에 결제 예정일이 표시돼요.",
      },
      {
        type: "design",
        text: "합계 카드를 더 보기 쉽게 정리하고, 소비 페이스 라인을 추가했어요.",
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-05-15",
    title: "내 급여일에 맞춘 예산",
    items: [
      {
        type: "feature",
        text: "이제 급여일을 기준으로 예산 주기를 맞출 수 있어요.",
      },
      {
        type: "feature",
        text: "친구에게 보여줄 항목을 직접 골라서 켜고 끌 수 있어요.",
      },
      {
        type: "improve",
        text: "로그인 오류 안내를 한국어로 친절하게 바꿨어요.",
      },
      {
        type: "feature",
        text: "구독 목록에 교통 카테고리 등을 더 추가했어요.",
      },
      {
        type: "design",
        text: "화면 전환이 더 매끄러워졌어요.",
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-05-13",
    title: "친구와 함께 쓸 수 있어요",
    items: [
      {
        type: "feature",
        text: "이제 친구 코드로 친구를 맺을 수 있어요. 닉네임은 자동으로 만들어드려요.",
      },
      {
        type: "feature",
        text: "친구의 소비가 실시간으로 반영돼요.",
      },
      {
        type: "feature",
        text: "거래를 삭제하거나, 메모(최대 100자)를 남길 수 있게 됐어요.",
      },
      {
        type: "design",
        text: "입력 화면이 부드럽게 올라오는 시트로 바뀌었어요.",
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-05-12",
    title: "고정지출과 캘린더가 생겼어요",
    items: [
      {
        type: "feature",
        text: "매달 나가는 고정지출을 따로 관리할 수 있어요. 구독 서비스 목록도 준비해뒀어요.",
      },
      {
        type: "feature",
        text: "대시보드에서 이번 달 소비를 캘린더로 한눈에 볼 수 있게 됐어요.",
      },
      {
        type: "improve",
        text: "아래 탭이 '소비'와 '고정지출' 두 개로 깔끔하게 정리됐어요.",
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-05-11",
    title: "티끌 시작!",
    summary: "이번 달 쓴 돈, 가장 빠르게 보는 가계부예요.",
    items: [
      {
        type: "feature",
        text: "이제 소비를 기록하고, 이번 달 쓴 돈과 예산 사용률을 한눈에 볼 수 있어요.",
      },
      {
        type: "feature",
        text: "금액을 빠르게 입력하고, 실수하면 되돌리기(↶)로 바로 취소할 수 있어요.",
      },
      {
        type: "feature",
        text: "최근 소비를 오늘·어제 날짜별로 묶어서 보여드려요.",
      },
    ],
  },
];

/** Latest shipped version — drives the one-time dashboard sheet. */
export const LATEST_RELEASE_VERSION = RELEASE_NOTES[0]?.version ?? "";
