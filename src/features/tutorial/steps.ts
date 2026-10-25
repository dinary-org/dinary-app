/**
 * 첫 실행 튜토리얼(1c) — 탭마다 처음 열 때 한 번. 문구는 확정본이라 그대로 씁니다.
 * targets 는 useTutorialTarget(id) 로 등록한 자리입니다. 등록된 자리가 하나도 없으면 그 단계는 건너뜁니다.
 */

export type TutorialKey = "map" | "couple" | "couple.account" | "calendar" | "couple.calendar" | "recommend" | "community.friends" | "community.gallery" | "community.ranking" | "community.board";
export const TUTORIAL_KEYS: TutorialKey[] = ["map", "couple", "couple.account", "calendar", "couple.calendar", "recommend", "community.friends", "community.gallery", "community.ranking", "community.board"];

export type Step = {
  title: string;
  desc: string;
  targets: string[];
  /** 구멍 모서리. "circle" 이면 너비 / 2. */
  radius?: number | "circle";
  /** 잰 자리 대신 그 가운데에 이 크기로 구멍을 냅니다(탭바 칸처럼 누름 영역이 넓은 곳). */
  box?: { w: number; h: number };
  sim?: "longPress" | "share";
  /** 앞 단계에 이어지는 체험은 별도 번호를 세지 않습니다. */
  unnumbered?: boolean;
  /** 강조 테두리와 실제 요소 사이의 간격. */
  ringGap?: number;
  /** intro · outro 는 번호를 세지 않고 글을 가운데 둡니다. */
  kind?: "intro" | "outro";
  /** 자리를 못 쟀을 때 쓸 원 — 화면 가운데, 위에서 y 비율 자리. 지도 빈 곳처럼 꼭 보여야 하는 단계만. */
  fallback?: { y: number; size: number };
  /** 연인 기록장을 보고 있을 때 바꿔 쓰는 글. */
  couple?: { title?: string; desc?: string };
};

export const STEPS: Record<TutorialKey, Step[]> = {
  map: [
    { kind: "intro", title: "다이너리에 오신 걸\n환영해요", desc: "", targets: [] },
    { title: "사진으로 기록", desc: "가게에서 사진을 찍으면 바로 기록이 시작되고, 다녀간 곳으로 인증돼요.", targets: ["tab.camera"], radius: "circle" },
    { title: "직접 추가", desc: "인증 없이 기록을 쓰거나, 가고 싶은 곳을 계획으로 담아요.", targets: ["map.plus"], radius: "circle" },
    { title: "지도에서 식당 보기", desc: "지도에서 아무 곳이나 꾹 누르고 있으면 식당을 찾아 줘요. 건물이면 그 안 식당을 층별로, 건물이 없으면 주변 식당을 찾아줘요.", targets: ["map.open"], radius: "circle", fallback: { y: 0.3, size: 200 } },
    { title: "길게 눌러 보기", desc: "화면을 꾹 눌러보세요.", targets: ["map.open"], radius: "circle", sim: "longPress", unnumbered: true, fallback: { y: 0.3, size: 200 } },
    { title: "보관함", desc: "쓰다 만 기록이 여기 모여요.", targets: ["map.drafts"], radius: "circle" },
    { title: "내 맛집 목록", desc: "지도에 있는 곳을 목록으로 봐요.", targets: ["map.sheet"], radius: 28 },
    { title: "기록장 바꾸기", desc: "개인 기록장과 연인 기록장을 오가요.", targets: ["map.book"], radius: 22 },
    { title: "라벨첩", desc: "기록이 쌓이면 라벨이 모여요. 닉네임 옆에 달 수 있어요.", targets: ["map.labels"], radius: "circle" },
    { title: "릴스 유튜브 블로그에서 담기", desc: "릴스, 블로그, 유튜브에서 공유를 누르고 다이너리를 골라보세요.", targets: [], sim: "share" },
    { title: "다른 탭", desc: "캘린더 · 추천 · 커뮤니티. 처음 들어가면 그 화면도 짧게 알려드릴게요.", targets: ["tab.calendar", "tab.recommend", "tab.community", "tab.couple"], radius: 16, box: { w: 60, h: 54 },
      couple: { desc: "캘린더 · 추천 · 연인. 처음 들어가면 그 화면도 짧게 알려드릴게요." } },
    { kind: "outro", title: "준비 끝", desc: "다음 식사 때 이 버튼으로 첫 기록을 남겨보세요.", targets: ["tab.camera"], radius: "circle" },
  ],
  // 연인 기록장을 처음 열었을 때(지도) — 지도 · 목록 · 캘린더 설명은 개인 기록장 튜토리얼과 같아서 연인 탭만 짚습니다.
  couple: [
    { title: "연인", desc: "둘이 함께 쓰는 기록장이에요. 연인 탭에서 우리 도장 · 만난 날 · 함께 간 곳을 모아 봐요. 처음 들어가면 짧게 알려드릴게요.", targets: ["tab.couple"], radius: 16, box: { w: 60, h: 54 } },
  ],
  // 연인 탭(연인계정)을 처음 열었을 때.
  "couple.account": [
    { title: "우리 도장", desc: "함께 간 기록마다 하트가 하나씩 찍혀요. 둘 다 한 줄을 남기면 하트가 다 차요. 나만 한 줄을 쓴 하트를 누르면 상대를 콕 찔러 부탁할 수 있어요.", targets: ["couple.stamps"], radius: 20 },
    { title: "만난 지", desc: "사귄 날부터 센 날이에요. 다음 기념일을 누르면 기념일마다 함께 먹은 식사를 모아 봐요.", targets: ["couple.since"], radius: 22 },
    { title: "우리 숫자", desc: "함께 간 식당, 기록, 인증을 둘이 합쳐 세요.", targets: ["couple.stats"], radius: 18 },
  ],
  calendar: [
    { title: "날짜별 기록", desc: "가게 이름이 날짜별로 기록돼요. 날짜를 누르면 그날 기록이 보여요.", targets: ["calendar.grid"], radius: 20 },
    { title: "리캡", desc: "분기마다 내가 먹은 기록을 정리해 줘요.", targets: ["calendar.recap"], radius: 18, ringGap: 0 },
  ],
  // 연인 기록장의 캘린더를 처음 열었을 때 — 개인 캘린더 튜토리얼을 이미 봤어도 따로 한 번.
  "couple.calendar": [
    { title: "기념일", desc: "사귄 날부터 100일마다, 그리고 해마다 기념일이 와요. 여기엔 다음 기념일까지 남은 날과 지난 기념일에 함께 먹은 식사가 보여요.", targets: ["calendar.anniversary"], radius: 20 },
    { title: "기념일 화면", desc: "배너를 누르면 지난 기념일이 날짜순으로 모여요. 그날 남긴 기록이 그 기념일의 식사가 되고, 다른 기록으로 바꿀 수도 있어요.", targets: ["calendar.anniversary"], radius: 20 },
    { title: "달력의 기념일", desc: "기념일인 날은 날짜에 연한 동그라미가 쳐지고 「100일」 · 「1주년」처럼 이름이 붙어요.", targets: ["calendar.grid"], radius: 20 },
  ],
  recommend: [
    { title: "지금 뭐 먹지", desc: "지금 위치와 시간에 어울리는 맛집을 추천해줘요.", targets: ["recommend.now"], radius: 20 },
    { title: "내 위치 · 시간", desc: "추천 기준이 되는 동네와 시간이에요. 눌러서 다른 동네나 시간으로 바꿀 수 있어요.", targets: ["recommend.where"], radius: 16 },
    { title: "둘러보기", desc: "다른 맛집들도 둘러봐요.", targets: ["recommend.browse"], radius: 16 },
    { title: "랜덤 게임", desc: "도저히 못 고르겠을 땐 게임으로 정해요. 추천된 가게 · 카테고리 · 직접 넣은 후보 중에서 하나가 뽑혀요.", targets: ["recommend.games"], radius: 16 },
  ],
  "community.friends": [
    { title: "커뮤니티 메뉴", desc: "친구 · 갤러리 · 랭킹 · 게시판이 있어요. 처음 들어가는 곳마다 짧게 알려드릴게요.", targets: ["community.tab.friends", "community.tab.gallery", "community.tab.ranking", "community.tab.board"], radius: 16, box: { w: 60, h: 54 } },
    { title: "친구 소식", desc: "친구가 인증한 기록이 여기 모여요. 동그라미를 누르면 친구별로 보여요.", targets: ["community.stories"], radius: 20 },
    { title: "소식 · 친구 지도", desc: "목록 대신 지도에서 친구들이 다녀온 곳이 보여요.", targets: ["community.segment"], radius: 18 },
  ],
  "community.gallery": [
    { title: "갤러리", desc: "다양한 음식 사진들이 있어요. 사진을 누르면 가게 정보가 보여요.", targets: ["community.gallery.grid"], radius: 16 },
  ],
  "community.ranking": [
    { title: "랭킹", desc: "인증 횟수, 처음 가 본 가게, 단골 같은 기준으로 순위를 매겨요.", targets: ["community.ranking.list"], radius: 20 },
  ],
  "community.board": [
    { title: "글 종류", desc: "여러 사람들과 의견을 나눠요.", targets: ["community.board.chips"], radius: 16, ringGap: 0 },
  ],
};

/** 커뮤니티는 들어갈 때 전환 판(약 1.5초)이 덮고 있어, 판이 걷힌 뒤 띄웁니다. */
export const COMMUNITY_DELAY = 1100;

/** 상호작용 단계에서 해낸 뒤 바뀌는 설명. */
export const SIM_DONE_DESC: Record<NonNullable<Step["sim"]>, string> = {
  longPress: "이렇게 떠요. 가게를 누르면 바로 그 가게 기록을 시작하고, 이미 기록한 곳이면 그 기록이 열려요.",
  share: "공유한 식당이 위시에 담겼어요. 지도에서 바로 볼 수 있어요.",
};
export const SIM_HINT: Record<NonNullable<Step["sim"]>, string> = { longPress: "원 안을 꾹 누르기", share: "다이너리 누르기" };
