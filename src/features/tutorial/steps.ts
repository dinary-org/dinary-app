/**
 * 첫 실행 튜토리얼(1c) — 탭마다 처음 열 때 한 번. 문구는 확정본이라 그대로 씁니다.
 * targets 는 useTutorialTarget(id) 로 등록한 자리입니다. 등록된 자리가 하나도 없으면 그 단계는 건너뜁니다.
 */

export type TutorialKey = "map" | "couple" | "calendar" | "recommend" | "community.friends" | "community.gallery" | "community.ranking" | "community.board";
export const TUTORIAL_KEYS: TutorialKey[] = ["map", "couple", "calendar", "recommend", "community.friends", "community.gallery", "community.ranking", "community.board"];

export type Step = {
  title: string;
  desc: string;
  targets: string[];
  /** 구멍 모서리. "circle" 이면 너비 / 2. */
  radius?: number | "circle";
  /** 잰 자리 대신 그 가운데에 이 크기로 구멍을 냅니다(탭바 칸처럼 누름 영역이 넓은 곳). */
  box?: { w: number; h: number };
  sim?: "longPress" | "share";
  /** intro · outro 는 번호를 세지 않고 글을 가운데 둡니다. */
  kind?: "intro" | "outro";
  /** 연인 기록장을 보고 있을 때 바꿔 쓰는 글. */
  couple?: { title?: string; desc?: string };
};

export const STEPS: Record<TutorialKey, Step[]> = {
  map: [
    { kind: "intro", title: "다이너리에 오신 걸\n환영해요", desc: "", targets: [] },
    { title: "사진으로 기록", desc: "가게에서 사진을 찍으면 바로 기록이 시작되고, 다녀간 곳으로 인증돼요.", targets: ["tab.camera"], radius: "circle" },
    { title: "직접 추가", desc: "사진 없이 기록을 쓰거나, 가고 싶은 곳을 계획으로 담아요.", targets: ["map.plus"], radius: "circle" },
    { title: "길게 눌러 보기", desc: "원 안을 꾹 눌러보세요. 그 건물 안이나 근처에 있는 식당 정보가 떠요.", targets: ["map.open"], radius: "circle", sim: "longPress" },
    { title: "보관함", desc: "쓰다 만 기록과 올리는 중인 기록이 여기 모여요.", targets: ["map.drafts"], radius: "circle" },
    { title: "내 맛집 목록", desc: "지도에 있는 곳을 목록으로 봐요. 위로 끌어올리면 넓어져요.", targets: ["map.sheet"], radius: 28 },
    { title: "기록장 바꾸기", desc: "개인 기록장과 연인 기록장을 오가요.", targets: ["map.book"], radius: 22 },
    { title: "라벨첩", desc: "기록이 쌓이면 라벨이 모여요. 닉네임 옆에 달 수 있어요.", targets: ["map.labels"], radius: "circle" },
    { title: "릴스 · 유튜브에서 담기", desc: "릴스나 유튜브에서 공유를 누르고 다이너리를 골라보세요.", targets: [], sim: "share" },
    { title: "다른 탭", desc: "캘린더 · 추천 · 커뮤니티. 처음 들어가면 그 화면도 짧게 알려드릴게요.", targets: ["tab.calendar", "tab.recommend", "tab.community", "tab.couple"], radius: 16, box: { w: 60, h: 54 },
      couple: { desc: "캘린더 · 추천 · 연인. 처음 들어가면 그 화면도 짧게 알려드릴게요." } },
    { kind: "outro", title: "준비 끝", desc: "다음 식사 때 이 버튼으로 첫 기록을 남겨보세요.", targets: ["tab.camera"], radius: "circle" },
  ],
  // 연인 기록장을 처음 열었을 때(지도) — 지도 튜토리얼 바로 뒤에 이어질 수도 있습니다.
  couple: [
    { title: "우리 기록장", desc: "지금은 둘이 함께 쓰는 기록장이에요. 여기를 누르면 개인 기록장으로 돌아가요.", targets: ["map.book"], radius: 22 },
    { title: "우리 기록", desc: "둘 중 누가 기록해도 여기 함께 쌓여요. 가게마다 서로 남긴 한 줄이 붙고, 아직 비었으면 상대를 기다려요.", targets: ["map.sheet"], radius: 28 },
    { title: "연인", desc: "우리의 인증, 기념일 식사, 함께 모은 라벨을 봐요. 나만 한 줄을 쓴 기록은 콕 찔러 상대에게 부탁해요.", targets: ["tab.couple"], radius: 16, box: { w: 60, h: 54 } },
    { title: "기념일", desc: "캘린더 위에 다음 기념일까지 남은 날이 떠요. 기념일마다 그날 함께 먹은 식사를 남겨 둬요.", targets: ["tab.calendar"], radius: 16, box: { w: 60, h: 54 } },
  ],
  calendar: [
    { title: "날짜별 기록", desc: "먹은 날에 가게 이름이 적혀요. 날짜를 누르면 그날 기록을 봐요.", targets: ["calendar.grid"], radius: 20 },
    { title: "리캡", desc: "분기마다 내가 먹은 기록을 한 장으로 정리해 줘요.", targets: ["calendar.recap", "calendar.anniversary"], radius: 20,
      couple: { title: "기념일", desc: "다음 기념일까지 남은 날이에요. 누르면 지난 기념일마다 함께 먹은 식사를 봐요." } },
  ],
  recommend: [
    { title: "지금 뭐 먹지", desc: "지금 위치와 시간에 맞는 한 곳을 골라줘요.", targets: ["recommend.now"], radius: 20 },
    { title: "내 위치 · 시간", desc: "추천 기준이 되는 동네와 시간이에요. 눌러서 다른 동네나 시간으로 바꿀 수 있어요.", targets: ["recommend.where"], radius: 16 },
    { title: "둘러보기", desc: "동네와 조건을 골라 여러 곳을 한 번에 봐요.", targets: ["recommend.browse"], radius: 16 },
  ],
  "community.friends": [
    { title: "커뮤니티 메뉴", desc: "친구 · 갤러리 · 랭킹 · 게시판을 오가요. 처음 들어가는 곳마다 짧게 알려드릴게요.", targets: ["community.tab.friends", "community.tab.gallery", "community.tab.ranking", "community.tab.board"], radius: 16, box: { w: 60, h: 54 } },
    { title: "친구 소식", desc: "친구가 인증한 기록이 여기 모여요. 동그라미를 누르면 친구별로 봐요.", targets: ["community.stories"], radius: 20 },
    { title: "소식 · 친구 지도", desc: "목록 대신 지도에서 친구들이 다녀온 곳을 봐요.", targets: ["community.segment"], radius: 18 },
  ],
  "community.gallery": [
    { title: "갤러리", desc: "모두가 올린 인증 사진이 모여요. 사진을 누르면 가게 정보를 봐요.", targets: ["community.gallery.grid"], radius: 16 },
  ],
  "community.ranking": [
    { title: "랭킹", desc: "인증 횟수, 처음 가 본 가게, 단골 같은 기준으로 순위를 매겨요.", targets: ["community.ranking.list"], radius: 20 },
    { title: "구경 중 · 참여", desc: "지금은 구경만 하는 중이에요. 눌러서 참여하면 내 순위도 올라가요.", targets: ["community.ranking.join"], radius: "circle" },
  ],
  "community.board": [
    { title: "글 종류", desc: "주제, 어디 가요?, 기록 나눔으로 골라 보거나 동네를 좁혀요.", targets: ["community.board.chips"], radius: 18 },
  ],
};

/** 커뮤니티는 들어갈 때 전환 판(약 1.5초)이 덮고 있어, 판이 걷힌 뒤 띄웁니다. */
export const COMMUNITY_DELAY = 1100;

/** 상호작용 단계에서 해낸 뒤 바뀌는 설명. */
export const SIM_DONE_DESC: Record<NonNullable<Step["sim"]>, string> = {
  longPress: "이 건물 안과 근처 식당이 떠요. 눌러서 바로 기록하거나 위시에 담을 수 있어요.",
  share: "공유한 식당이 위시에 담겼어요. 지도에서 바로 볼 수 있어요.",
};
export const SIM_HINT: Record<NonNullable<Step["sim"]>, string> = { longPress: "원 안을 꾹 누르기", share: "다이너리 누르기" };
