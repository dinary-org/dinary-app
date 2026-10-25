import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, FadeIn, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Text } from "@/components/Text";
import { C, F } from "@/theme";
import { SIM_DONE_DESC, SIM_HINT } from "./steps";
import { useTutorial, type Hole } from "./TutorialProvider";
import LongPressSim from "./sims/LongPressSim";
import ShareSheetSim, { ReelsBackdrop } from "./sims/ShareSheetSim";

/**
 * 첫 실행 튜토리얼(1c) — 화면을 어둡게 덮고 자리마다 구멍을 뚫어 점선으로 두릅니다. 글은 카드 없이 어둠 위에.
 * 아무 데나 누르면 다음 단계, 「건너뛰기」 · 뒤로가기는 닫기. 뿌리에 한 번 그립니다(탭 · 시트 위).
 */

const SLOTS = 4;
const FIELDS = 6; // x, y, w, h, r, ring offset
const TEXT_W = 300;
/** 글 블록(번호 · 제목 · 두세 줄 설명 · 아랫줄)에 넉넉히 잡는 높이. */
const TEXT_NEED = 190;
const HINT = C.dim;
const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function CoachOverlay() {
  const { active, step, holes } = useTutorial();
  if (!active || !step || !holes) return null;
  return <Overlay />;
}

function Overlay() {
  const t = useTutorial();
  const { step, holes, fresh, number, last, next, close } = t;
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ w: win.width, h: win.height });
  const [reader, setReader] = useState(false);
  const stepId = `${t.active!.key}.${t.active!.index}`;
  // 단계마다 새로 — 어느 단계의 값인지 함께 적어 두고, 다른 단계 것이면 버립니다.
  const [doneAt, setDoneAt] = useState<string | null>(null);
  const [box, setBox] = useState<{ id: string; y: number; h: number } | null>(null);
  const simDone = doneAt === stepId;
  const setSimDone = () => setDoneAt(stepId);
  const textBox = box?.id === stepId ? box : null;

  useEffect(() => { void AccessibilityInfo.isScreenReaderEnabled().then(setReader); }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { close(); return true; });
    return () => sub.remove();
  }, [close]);

  const off = holes!.length > 1 ? 4 : 7;
  const textW = Math.min(TEXT_W, size.w - 32);
  const centered = step?.kind === "intro" || step?.kind === "outro";
  // 글 자리 — 구멍 가운데가 화면 위쪽이면 구멍 아래 24, 아니면 구멍 위 24.
  // 달력 칸처럼 큰 자리라 그쪽에 글이 들어갈 틈이 없으면 구멍을 그만큼 줄입니다.
  const placed = useMemo(() => {
    const u = union(holes!);
    if (!step || step.kind === "intro" || !u) return { holes: holes!, pos: null };
    const left = centered ? (size.w - textW) / 2 : clamp(u.x + u.w / 2 - textW / 2, 16, size.w - textW - 16);
    const below = u.y + u.h / 2 < size.h / 2;
    if (below) {
      const maxBottom = size.h - insets.bottom - TEXT_NEED - 24 - off;
      const hs = holes!.map((h) => (h.y + h.h > maxBottom ? { ...h, h: Math.max(40, maxBottom - h.y) } : h));
      const v = union(hs)!;
      return { holes: hs, pos: { top: v.y + v.h + off + 24, left } };
    }
    const minTop = insets.top + TEXT_NEED + 24 + off;
    const hs = holes!.map((h) => (h.y < minTop ? { ...h, y: minTop, h: Math.max(40, h.y + h.h - minTop) } : h));
    const v = union(hs)!;
    return { holes: hs, pos: { bottom: size.h - (v.y - off) + 24, left } };
  }, [holes, step, size.w, size.h, textW, centered, off, insets.top, insets.bottom]);
  const shown = placed.holes;
  const slots = useSlots(shown, off, size);

  if (!step) return null;
  const sim = step.sim;
  // 상호작용 단계는 해낼 때까지 바깥을 눌러도 넘어가지 않습니다(화면 읽기를 켰으면 그냥 넘어갑니다).
  const waiting = !!sim && !simDone && !reader;
  const advance = () => { if (!waiting) next(); };

  const pos: { top?: number; bottom?: number; left: number } = placed.pos
    ?? (step.kind === "intro" ? { top: size.h * 0.38, left: (size.w - textW) / 2 } : { top: insets.top + 96, left: 16 });

  const desc = sim && simDone ? SIM_DONE_DESC[sim] : step.desc;
  const hint = step.kind === "intro" ? "탭해서 시작 →" : waiting ? SIM_HINT[sim!] : last ? "탭해서 닫기" : "탭해서 계속 →";
  const align = centered ? "center" : "left";

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      onPress={advance}
      accessible={false}
      accessibilityViewIsModal
    >
      {sim === "share" && <ReelsBackdrop />}
      <Dim slots={slots} w={size.w} h={size.h} />
      {Array.from({ length: SLOTS }, (_, i) => <Ring key={i} slots={slots} i={i} />)}

      {fresh && <Animated.View
        key={stepId}
        entering={FadeIn.duration(220)}
        style={[s.text, { width: textW }, pos]}
        onLayout={(e) => setBox({ id: stepId, y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
        accessible
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`튜토리얼, 탭해서 다음. ${step.title.replace("\n", " ")}. ${desc}`}
        accessibilityActions={[{ name: "activate" }, { name: "escape" }]}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === "escape" ? close() : advance())}
      >
        {number && <Text style={s.num}>{`${pad(number.n)} / ${pad(number.of)}`}</Text>}
        <Text style={[step.kind === "intro" ? s.intro : s.title, { textAlign: align }]}>{step.title}</Text>
        {!!desc && <Text style={[s.desc, { textAlign: align }]}>{desc}</Text>}
        <View style={[s.foot, centered && { justifyContent: "center" }]}>
          <Text style={s.hint}>{hint}</Text>
          {!(last && step.kind === "outro") && (
            <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="튜토리얼 건너뛰기">
              <Text style={s.skip}>건너뛰기</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>}

      {fresh && sim === "longPress" && shown[0] && (
        <LongPressSim key={stepId} hole={shown[0]} done={simDone} onDone={setSimDone} onNext={next}
          cardTop={textBox && (pos.top != null ? textBox.y + textBox.h + 16 : shown[0].y + shown[0].h + off + 16)} cardLeft={pos.left} width={textW} bottomLimit={size.h - insets.bottom - 12} />
      )}
      {sim === "share" && <ShareSheetSim key={stepId} done={simDone} onDone={setSimDone} onNext={next} />}
    </Pressable>
  );
}

/* ── 구멍 · 점선 — 이전 자리에서 다음 자리로 250ms ──────────────── */

type Slots = { from: SharedValue<number[]>; to: SharedValue<number[]>; t: SharedValue<number> };

function useSlots(holes: Hole[], off: number, size: { w: number; h: number }): Slots {
  const target = useMemo(() => {
    const c = holes[0] ? { x: holes[0].x + holes[0].w / 2, y: holes[0].y + holes[0].h / 2 } : { x: size.w / 2, y: size.h / 2 };
    const out: number[] = [];
    for (let i = 0; i < SLOTS; i++) {
      const h = holes[i];
      out.push(...(h ? [h.x, h.y, h.w, h.h, h.r, off] : [c.x, c.y, 0, 0, 0, 0]));
    }
    return out;
  }, [holes, off, size.w, size.h]);
  const from = useSharedValue(target);
  const to = useSharedValue(target);
  const t = useSharedValue(1);
  useEffect(() => {
    const k = t.value;
    from.value = from.value.map((a, i) => a + (to.value[i] - a) * k);
    to.value = target;
    t.value = 0;
    t.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  return { from, to, t };
}

function slot(sl: Slots, i: number) {
  "worklet";
  const a = sl.from.value, b = sl.to.value, k = sl.t.value, o = i * FIELDS;
  const v = (j: number) => a[o + j] + (b[o + j] - a[o + j]) * k;
  return { x: v(0), y: v(1), w: v(2), h: v(3), r: v(4), off: v(5) };
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  "worklet";
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x + q} ${y}H${x + w - q}A${q} ${q} 0 0 1 ${x + w} ${y + q}V${y + h - q}A${q} ${q} 0 0 1 ${x + w - q} ${y + h}`
    + `H${x + q}A${q} ${q} 0 0 1 ${x} ${y + h - q}V${y + q}A${q} ${q} 0 0 1 ${x + q} ${y}Z`;
}

/** 어둠 한 장 — 바깥 사각형 + 구멍마다 둥근 사각형, evenodd 로 뚫습니다. */
function Dim({ slots, w, h }: { slots: Slots; w: number; h: number }) {
  const props = useAnimatedProps(() => {
    let d = `M0 0H${w}V${h}H0Z`;
    for (let i = 0; i < SLOTS; i++) {
      const r = slot(slots, i);
      if (r.w > 0.5 && r.h > 0.5) d += roundRect(r.x, r.y, r.w, r.h, r.r);
    }
    return { d };
  });
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={w} height={h}>
      <AnimatedPath animatedProps={props} fill={C.coachDim} fillRule="evenodd" />
    </Svg>
  );
}

function Ring({ slots, i }: { slots: Slots; i: number }) {
  const style = useAnimatedStyle(() => {
    const r = slot(slots, i);
    return {
      left: r.x - r.off, top: r.y - r.off, width: r.w + r.off * 2, height: r.h + r.off * 2,
      borderRadius: r.r + r.off, opacity: r.w > 0.5 ? 1 : 0,
    };
  });
  return <Animated.View pointerEvents="none" style={[s.ring, style]} />;
}

/* ── 도움 ─────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function union(holes: Hole[]) {
  if (!holes.length) return null;
  const x = Math.min(...holes.map((h) => h.x)), y = Math.min(...holes.map((h) => h.y));
  return { x, y, w: Math.max(...holes.map((h) => h.x + h.w)) - x, h: Math.max(...holes.map((h) => h.y + h.h)) - y };
}

const s = StyleSheet.create({
  ring: { position: "absolute", borderWidth: 2, borderStyle: "dashed", borderColor: C.coachRing },
  text: { position: "absolute" },
  num: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: C.coachRing },
  intro: { fontFamily: F.serif, fontSize: 30, lineHeight: 42, color: C.card },
  title: { marginTop: 8, fontFamily: F.serif, fontSize: 27, lineHeight: 36, color: C.card },
  desc: { marginTop: 8, fontFamily: F.serif, fontSize: 16, lineHeight: 16 * 1.65, color: C.lineSoft },
  foot: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 16 },
  hint: { fontFamily: F.mono, fontSize: 10.5, color: HINT },
  skip: { fontFamily: F.sans, fontSize: 12, color: HINT, textDecorationLine: "underline" },
});
