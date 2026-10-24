import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Circle, Polygon } from "react-native-svg";
import { BURST_POINTS } from "@/components/icons";
import { STAMPS_PER_BOARD } from "@/lib/labels";
import { C, F } from "@/theme";

/**
 * 도장 한 개 — 인증마크와 같은 24각 톱니 seal 안에 흰 「D」(지시서 4 §2). 숫자는 넣지 않고, 기울이지도 않습니다.
 * ring 이면 안쪽에 흰 점선 원(리캡 표지의 큰 도장) — 그만큼 D 를 조금 작게.
 */
export function Stamp({ size = 44, ring }: { size?: number; ring?: boolean }) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute" }}>
        <Polygon points={BURST_POINTS} fill={C.brick} />
        {ring && <Circle cx={50} cy={50} r={36} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="4 3.5" />}
      </Svg>
      <Text style={{ fontFamily: F.serif, fontSize: size * (ring ? 0.27 : 0.31), lineHeight: size * (ring ? 0.33 : 0.38), color: "#fff", ...WHITE_BOLD }}>D</Text>
    </View>
  );
}

/** 고운돋움은 굵기가 하나라 흰 그림자를 둘러 700 처럼 보이게. */
const WHITE_BOLD = { textShadowColor: "#fff", textShadowRadius: 1.4, textShadowOffset: { width: 0, height: 0 } };

/** 빈 칸 — 점선 원. label 이 있으면 가운데 Mono 다음 번호. */
export function EmptySlot({ size = 44, label }: { size?: number; label?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#d6c4b8", alignItems: "center", justifyContent: "center" }}>
      {label != null && <Text style={{ fontFamily: F.mono, fontSize: Math.max(9, size * 0.26), color: "#c9b5a7" }}>{label}</Text>}
    </View>
  );
}

/**
 * 방금 찍은 도장 — 회전 없이 크기만: scale 2.2 → 0.92(60%) → 1, 0.55s, cubic-bezier(.3,1.4,.5,1), delay 뒤(기본 0.25s).
 * shadow 면 벽돌색 그림자(도장 팝업의 마지막 칸). 다시 틀고 싶으면 key 를 바꿉니다.
 */
export function StampingIn({ size = 44, delay = 250, shadow, children }: { size?: number; delay?: number; shadow?: boolean; children?: React.ReactNode }) {
  const scale = useSharedValue(2.2);
  const op = useSharedValue(0);
  useEffect(() => {
    const ease = Easing.bezier(0.3, 1.4, 0.5, 1);
    op.value = withDelay(delay, withTiming(1, { duration: 330 }));
    scale.value = withDelay(delay, withSequence(withTiming(0.92, { duration: 330, easing: ease }), withTiming(1, { duration: 220, easing: ease })));
  }, [delay, op, scale]);
  const style = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[style, shadow && { shadowColor: C.brick, shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 3 } }]}>
      {children ?? <Stamp size={size} />}
    </Animated.View>
  );
}

/**
 * 도장판 5×2. filled 칸까지 찍혀 있고, fresh(1~10) 칸만 찍히는 애니메이션. firstNo 는 이 판의 1칸 번호(빈 칸 숫자에 씀).
 */
export function StampBoard({ filled, fresh, size = 44, gap = 10, firstNo, numberEmpty }: {
  filled: number; fresh?: number | null; size?: number; gap?: number; firstNo: number; numberEmpty?: boolean;
}) {
  const slots = Array.from({ length: STAMPS_PER_BOARD }, (_, i) => i + 1);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", width: size * 5 + gap * 4, rowGap: gap, columnGap: gap }}>
      {slots.map((k) => {
        const no = firstNo + k - 1;
        if (k > filled) return <EmptySlot key={k} size={size} label={numberEmpty ? no : undefined} />;
        if (k === fresh) return <StampingIn key={k} size={size} shadow />;
        return <Stamp key={k} size={size} />;
      })}
    </View>
  );
}
