import * as Haptics from "expo-haptics";
import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { BuildingView, type Info } from "@/features/map/PlacesAtSheet";
import type { BuildingData, PlaceAt } from "@/features/map/usePlacesAt";
import { C } from "@/theme";
import type { Hole } from "../TutorialProvider";

/**
 * 튜토리얼 3 · 길게 눌러 보기 — 구멍 위를 꾹 누르면 둥근 물결이 18 → 130 으로 자라고, 500ms 가 차면
 * 실제 지도 길게 누르기와 같은 건물 그림(BuildingView)을 정해 둔 예시로 띄웁니다. 진짜 기록 · 서버는 건드리지 않습니다.
 */

const HOLD_MS = 500;

const place = (id: string, name: string, category: string, kind: PlaceAt["kind"], appCategory: string): PlaceAt => ({
  id, name, category, kind, appCategory, myRecordCount: 0, isWish: false, lat: 37.5446, lng: 127.0559, addr: "서울 성동구 성수동",
});
const SAMPLE: BuildingData = {
  mode: "building",
  building: { id: "tutorial", name: "서울숲 IT타워", roadAddr: "서울 성동구 성수이로 113", footprint: null },
  floors: [
    { floor: "1F", places: [place("t1", "성수 파스타바", "양식", "restaurant", "양식"), place("t2", "스탠딩 커피", "카페", "cafe", "카페")] },
    { floor: "B1", places: [place("t3", "우동 카덴", "일식", "restaurant", "일식")] },
  ],
};
const info: Info = () => ({ recs: [], count: 0, wish: false });

type Props = {
  hole: Hole;
  done: boolean;
  onDone: () => void;
  onNext: () => void;
  /** 카드 윗변 — 글 블록을 잰 뒤에 정해집니다. */
  cardTop: number | null;
  bottomInset: number;
  height: number;
};

export default function LongPressSim({ hole, done, onDone, onNext, cardTop, bottomInset, height }: Props) {
  const grow = useSharedValue(0);
  const doneRef = useRef(false);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDone();
  };
  const ripple = useAnimatedStyle(() => {
    const d = 18 + (130 - 18) * grow.value;
    return { width: d, height: d, borderRadius: d / 2, opacity: grow.value > 0 ? 1 : 0 };
  });

  return (
    <>
      {!done && <Pressable
        style={{ position: "absolute", left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: hole.r, alignItems: "center", justifyContent: "center" }}
        accessibilityRole="button"
        accessibilityLabel="원 안을 꾹 누르기"
        delayLongPress={HOLD_MS}
        onPressIn={() => {
          if (doneRef.current) return;
          grow.value = withTiming(1, { duration: HOLD_MS }, (ok) => { if (ok) scheduleOnRN(finish); });
        }}
        onPressOut={() => {
          // 다 차기 전에 떼면 처음으로.
          if (doneRef.current) return;
          cancelAnimation(grow);
          grow.value = 0;
        }}
        onLongPress={finish}
      >
        <Animated.View pointerEvents="none" style={[s.ripple, ripple]} />
      </Pressable>}

      {done && cardTop != null && (
        <Animated.View entering={FadeInDown.duration(240)} style={[s.card, { maxHeight: Math.max(0, height - cardTop), paddingBottom: bottomInset + 20 }]}>
          <Pressable onPress={onNext} style={{ flexShrink: 1 }}>
            <View pointerEvents="none" style={{ flexShrink: 1 }}>
              <BuildingView data={SAMPLE} info={info} onPick={onNext} onClose={onNext} />
            </View>
          </Pressable>
        </Animated.View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  ripple: { backgroundColor: "rgba(180,85,45,.22)", borderWidth: 2, borderColor: C.coachRing },
  card: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18 },
});
