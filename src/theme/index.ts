import { Platform, type TextStyle, type ViewStyle } from "react-native";

/** src/app/globals.css @theme 과 같은 값 — 핸드오프 §3. */
export const C = {
  paper: "#f6f3ec",
  card: "#fbfaf6",
  ink: "#1c1a17",
  brick: "#b4552d",
  brickSoft: "#f7ece5",
  line: "#d8d3c8",
  lineSoft: "#e2ddd2",
  muted: "#6b665e",
  faint: "#8a8377",
  map: "#e7e3d8",
  mapGrid: "#dcd7c9",
  mapRoad: "#f1ede2",
  mapPark: "#dfe4d6",
  /** 촬영 화면 배경 */
  dark: "#171614",
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
