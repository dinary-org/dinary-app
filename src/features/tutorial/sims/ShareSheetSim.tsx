import * as Haptics from "expo-haptics";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Text } from "@/components/Text";
import { C, F } from "@/theme";

/**
 * 튜토리얼 8 · 릴스 · 유튜브에서 담기 — 어둠 뒤에 릴스 화면 흉내, 어둠 위에 공유 시트 흉내.
 * 「다이너리」를 누르면 「위시에 담았어요」로 바뀔 뿐, 진짜 위시는 만들지 않습니다.
 * 실제 흐름: 공유 시트로 받은 글은 app/_layout.tsx 가 받아 /wish/new(share) 로 넘깁니다.
 */

const ICON = require("../../../../assets/icon.png");

/** 어둠 뒤 — 영상 판 · 재생 단추 · 오른쪽 좋아요 / 댓글 / 공유 · 아래 올린 사람. */
export function ReelsBackdrop() {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#0d0c0b" }]}>
      <View style={[s.frame, { top: insets.top + 12, bottom: insets.bottom + 12 }]}>
        <View style={s.play}>
          <Svg width={30} height={30} viewBox="0 0 24 24"><Path d="M8 5v14l11-7z" fill="#fff" /></Svg>
        </View>
        <View style={s.side}>
          {[HEART, BUBBLE, SEND].map((d, i) => (
            <Svg key={i} width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinejoin="round"><Path d={d} /></Svg>
          ))}
        </View>
        <Text style={s.caption}>@seongsu_eats · 성수 파스타바 봉골레 후기</Text>
      </View>
    </View>
  );
}

type Props = { done: boolean; onDone: () => void; onNext: () => void };

/** 어둠 위 — 아래에서 올라온 공유 시트(높이 300). */
export default function ShareSheetSim({ done, onDone, onNext }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable onPress={() => { if (done) onNext(); }} style={[s.sheet, { height: 300 + insets.bottom, paddingBottom: insets.bottom }]}>
      {done ? (
        <Animated.View entering={FadeIn.duration(220)} style={s.doneBox}>
          <View style={s.check}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={C.card} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
          </View>
          <Text style={s.doneTitle}>위시에 담았어요</Text>
          <Text style={s.doneSub}>성수 파스타바 · 서울 성동구 성수동</Text>
        </Animated.View>
      ) : (
        <>
          <Text style={s.title}>공유</Text>
          <Text style={s.sub}>성수 파스타바 봉골레 후기 · 릴스</Text>
          <View style={s.row}>
            <Target label="메시지"><View style={[s.app, { backgroundColor: "#4cb75c" }]}><Glyph d={BUBBLE} /></View></Target>
            <Target label="카카오톡"><View style={[s.app, { backgroundColor: "#f7d84a" }]}><Glyph d={BUBBLE} color="#3a2e1f" /></View></Target>
            <Pressable
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onDone(); }}
              accessibilityRole="button" accessibilityLabel="다이너리" style={s.target}
            >
              <View style={s.ring}><Image source={ICON} style={s.icon} /></View>
              <Text style={[s.label, { color: C.ink }]}>다이너리</Text>
            </Pressable>
            <Target label="링크 복사"><View style={[s.app, { backgroundColor: C.line2 }]}><Glyph d={LINK} color={C.muted} /></View></Target>
          </View>
        </>
      )}
    </Pressable>
  );
}

function Target({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.target}>
      {children}
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const Glyph = ({ d, color = "#fff" }: { d: string; color?: string }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><Path d={d} /></Svg>
);

const HEART = "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z";
const BUBBLE = "M4 12a8 7 0 1 1 3.5 5.8L4 19l1.2-3.3A6.6 6.6 0 0 1 4 12z";
const SEND = "M21 4L3 11l7 2.5L12.5 21z";
const LINK = "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1";

const s = StyleSheet.create({
  frame: { position: "absolute", left: 12, right: 12, borderRadius: 18, backgroundColor: "#2b2723", alignItems: "center", justifyContent: "center" },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,.18)", alignItems: "center", justifyContent: "center" },
  side: { position: "absolute", right: 14, bottom: 120, gap: 22, alignItems: "center" },
  caption: { position: "absolute", left: 16, right: 70, bottom: 28, fontFamily: F.sansMd, fontSize: 13, color: "#fff" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 22 },
  title: { fontFamily: F.serif, fontSize: 19, color: C.ink, textAlign: "center" },
  sub: { marginTop: 4, fontFamily: F.sans, fontSize: 12, color: C.faint, textAlign: "center" },
  row: { marginTop: 30, flexDirection: "row", justifyContent: "space-around" },
  target: { width: 72, alignItems: "center", gap: 8 },
  app: { width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  ring: { padding: 4, borderRadius: 18, borderWidth: 2, borderStyle: "dashed", borderColor: C.coachRing, margin: -6 },
  icon: { width: 56, height: 56, borderRadius: 14 },
  label: { fontFamily: F.sans, fontSize: 11.5, color: C.muted },
  doneBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 20 },
  check: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.brick, alignItems: "center", justifyContent: "center" },
  doneTitle: { marginTop: 14, fontFamily: F.serif, fontSize: 21, color: C.ink },
  doneSub: { marginTop: 6, fontFamily: F.sans, fontSize: 12.5, color: C.faint },
});
