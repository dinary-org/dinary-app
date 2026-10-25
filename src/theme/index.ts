import { Platform, type TextStyle, type ViewStyle } from "react-native";

/** src/app/globals.css @theme 과 같은 값 — 핸드오프 §3. */
export const C = {
  paper: "#ffffff",
  card: "#ffffff",
  ink: "#1c1a17",
  brick: "#b4552d",
  brickSoft: "#f8ede7",
  /** 좋아요 하트 — 벽돌색보다 붉은 빨강. */
  heart: "#e5303a",
  line: "#dfdcd7",
  lineSoft: "#ece9e5",
  /** 카드 테두리 · 선 버튼 · 빈 별 · 구분선 */
  line2: "#e3e0db",
  /** 시트 손잡이 · 「|」 구분 · 빈 아바타 */
  lineStrong: "#d1cdc6",
  /** 고르지 않은 맛집/카페 글씨 */
  ghost: "#c6c2bb",
  /** 꺼진 탭 아이콘 · 글씨, 입력 안내 글씨 */
  dim: "#a29d95",
  /** 세그먼트 바탕(맛집 기록/위시리스트, 게임) · 작은 아이콘 칸 */
  seg: "#f3f1ee",
  /** 개수 배지 · 태그 칩 · 아바타 칸 */
  chip: "#f2efeb",
  /** 인증 카드 테두리 · 날짜 정한 위시 테두리 · 칩 테두리 */
  brickLine: "#e6c9b8",
  muted: "#6b665e",
  faint: "#8a8377",
  map: "#efedea",
  mapGrid: "#e3e0db",
  mapRoad: "#fbfaf8",
  mapPark: "#e3e8de",
  /** 촬영 화면 배경 */
  dark: "#171614",
  /** 첫 실행 튜토리얼 — 화면을 덮는 어둠 · 구멍 둘레 점선 */
  coachDim: "rgba(20,18,15,0.76)",
  coachRing: "#e2a585",
} as const;

export const F = {
  /** 제목 글씨체 — 고운돋움 */
  serif: "GowunDodum_400Regular",
  sans: "NotoSansKR_400Regular",
  sansMd: "NotoSansKR_500Medium",
  sansBd: "NotoSansKR_700Bold",
  mono: "JetBrainsMono_400Regular",
} as const;

/** 고운돋움(F.serif)은 굵기가 하나뿐이라, 같은 색 그림자를 살짝 둘러 조금 굵어 보이게 합니다 — 가게 이름에 씁니다. */
export const FAINT_BOLD: TextStyle = { textShadowColor: C.ink, textShadowRadius: 0.6, textShadowOffset: { width: 0, height: 0 } };

const shadow = (opacity: number, radius: number, y: number, elevation: number): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: C.ink,
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: y },
    },
    default: { elevation },
  })!;

/** 핸드오프 §3 — 카드 / 시트 / 큰 카드 그림자. */
export const SHADOW = {
  card: shadow(0.08, 14, 4, 2),
  sheet: shadow(0.13, 30, -10, 12),
  big: shadow(0.09, 32, 12, 10),
};

export const TAB_BAR_H = 74;
