import { Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/Text";
import { C, F } from "@/theme";
import { useRestartTutorial } from "./TutorialProvider";

/**
 * TEMP(테스트용) — 어느 화면에서나 튜토리얼을 처음부터 다시 봅니다. 본 기록을 모두 지우고 지도로 갑니다.
 * 각 탭 튜토리얼도 다시 뜨니 탭을 하나씩 들어가 보면 됩니다. 다 보면 SHOW 를 false 로 두거나 이 파일과 app/_layout.tsx 의 한 줄을 지웁니다.
 */
export const SHOW_TUTORIAL_TEST_BUTTON = true;

export default function TestReplayButton() {
  const restart = useRestartTutorial();
  if (!SHOW_TUTORIAL_TEST_BUTTON) return null;
  return (
    <Pressable onPress={restart} accessibilityLabel="튜토리얼 다시 보기(테스트)" hitSlop={8} style={s.btn}>
      <Text style={s.label}>튜토리얼 ↺</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { position: "absolute", left: 0, top: "46%", paddingVertical: 8, paddingHorizontal: 10, borderTopRightRadius: 14, borderBottomRightRadius: 14, backgroundColor: "rgba(28,26,23,.72)" },
  label: { fontFamily: F.mono, fontSize: 10.5, color: C.card },
});
