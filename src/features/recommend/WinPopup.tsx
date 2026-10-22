import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Modal, Pressable, Text, useWindowDimensions, View } from "react-native";
import { C, F, FAINT_BOLD } from "@/theme";

/** 꽃가루 색 — 앱 톤(벽돌 · 살구 · 겨자 · 올리브 · 청록 · 장미 · 모래). */
const BITS = ["#b4552d", "#e08a63", "#d9a441", "#7d8a4a", "#4f7f7a", "#c9727d", "#c8ab83"];
const BIT_N = 36;
const FALL_MS = 2200;

/**
 * 구슬 경주 · 줄다리기가 끝나면 화면 한가운데 크게 뜨는 「오늘은 이걸로」 창. 뜰 때 카드가 튀어 오르고 위에서 꽃가루가 떨어집니다.
 * 바깥이나 「닫기」를 누르면 닫힙니다. action 이 있으면(추천된 가게 · 카테고리) 그 단추를 같이 보여 줍니다.
 */
export function WinPopup({ label, action, onClose }: {
  label: string | null; action: { text: string; onPress: () => void } | null; onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const pop = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  // 꽃가루마다 가로 자리 · 흔들림 · 도는 양 · 늦게 출발하는 정도를 한 번 뽑아 둡니다.
  const bits = useMemo(() => Array.from({ length: BIT_N }, (_, i) => ({
    x: Math.random() * width,
    sway: (Math.random() - 0.5) * 80,
    spin: (Math.random() - 0.5) * 4 * 360,
    delay: Math.random() * 0.35,
    w: 6 + Math.random() * 5,
    h: 9 + Math.random() * 6,
    color: BITS[i % BITS.length],
    round: i % 3 === 0,
  })), [width, label]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!label) return;
    pop.setValue(0);
    fall.setValue(0);
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(fall, { toValue: 1, duration: FALL_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [label, pop, fall]);

  return (
    <Modal visible={!!label} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(28,26,23,.45)", justifyContent: "center", paddingHorizontal: 32 }}>
        <Animated.View style={{ opacity: pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
          <Pressable onPress={() => {}} style={{ borderRadius: 26, backgroundColor: C.card, paddingHorizontal: 22, paddingTop: 30, paddingBottom: 18, alignItems: "center" }}>
            <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 2.4, color: C.brick }}>오늘은 이걸로</Text>
            <Text adjustsFontSizeToFit numberOfLines={2} style={[FAINT_BOLD, { marginTop: 12, fontFamily: F.serif, fontSize: 34, lineHeight: 44, color: C.ink, textAlign: "center" }]}>{label}</Text>
            <View style={{ marginTop: 26, alignSelf: "stretch", flexDirection: "row", gap: 8 }}>
              <Pressable onPress={onClose} accessibilityRole="button" style={{ flex: 1, height: 48, borderRadius: 16, borderWidth: 1, borderColor: "#ded8cb", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: F.sans, fontSize: 13.5, color: C.muted }}>닫기</Text>
              </Pressable>
              {action && (
                <Pressable onPress={action.onPress} accessibilityRole="button" style={{ flex: 1.4, height: 48, borderRadius: 16, backgroundColor: C.brick, alignItems: "center", justifyContent: "center" }}>
                  <Text numberOfLines={1} style={{ fontFamily: F.sansMd, fontSize: 13.5, color: C.card }}>{action.text}</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Animated.View>
        {/* 꽃가루 — 손가락을 막지 않게 pointerEvents 를 끕니다. */}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height }}>
          {bits.map((b, i) => {
            const t = fall.interpolate({ inputRange: [0, b.delay, 1], outputRange: [0, 0, 1], extrapolate: "clamp" });
            return (
              <Animated.View
                key={i}
                style={{
                  position: "absolute", left: b.x, top: -20, width: b.w, height: b.round ? b.w : b.h, borderRadius: b.round ? b.w / 2 : 1.5, backgroundColor: b.color,
                  opacity: t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
                  transform: [
                    { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.9] }) },
                    { translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, b.sway, b.sway * 0.4] }) },
                    { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${b.spin}deg`] }) },
                  ],
                }}
              />
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}
