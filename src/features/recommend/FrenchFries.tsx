import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, TextInput, View } from "react-native";
import Svg, { Defs, G, Line, LinearGradient, Rect, Stop } from "react-native-svg";
import { C, F } from "@/theme";

/**
 * 설정으로 뺀 값 — 타이머 표시(1초 뒤 숨김 · 처음부터 숨김 · 끝까지 보임) · 퍼펙트 범위(ms) · 목표 시간 최소 · 최대(초).
 */
export const FRIES = {
  timer: "after1s" as "after1s" | "hidden" | "visible",
  perfectMs: 50,
  targetMin: 3.0,
  targetMax: 8.0,
};
/** 목표보다 이만큼 지나면 저절로 건집니다 · 마지막 사람이 건지고 결과로 넘어가기까지. */
const AUTO_LIFT_S = 4.5;
const RESULT_DELAY_MS = 2200;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const NAME_LEN = 8;

const HI = "#f2ddcf";
const LED = "#ffb04a";
const VERDICT = {
  perfect: { label: "퍼펙트", ink: C.brick },
  under: { label: "덜 익음", ink: "#9a7a2c" },
  over: { label: "탔음", ink: "#5e3820" },
} as const;
type Verdict = keyof typeof VERDICT;

/**
 * 멘트 — 다섯 묶음 × 5. 시안(DINARY 감자튀김 게임.dc.html)의 MENTS 로 바꿔 넣을 자리입니다(지금은 임시 문구).
 */
const MENTS: Record<"perfect" | "underNear" | "underFar" | "overNear" | "overFar", string[]> = {
  perfect: ["황금빛 그 자체", "튀김 장인 등장", "겉바속촉 완성", "이건 팔아도 돼요", "타이머가 몸에 있네요"],
  underNear: ["조금만 더 있었으면", "아깝다, 한 끗 차이", "속이 살짝 덜 익었어요", "성격이 급하시네요", "거의 다 왔는데"],
  underFar: ["아직 생감자예요", "기름에 인사만 했네요", "너무 일찍 건졌어요", "이건 감자 샐러드", "튀김기가 섭섭해해요"],
  overNear: ["살짝 바삭 과하게", "조금 진한 갈색", "한 박자 늦었어요", "그래도 먹을 만해요", "과자 같은 식감"],
  overFar: ["숯이 되어 버렸어요", "주방에 연기가 자욱", "이건 장작이에요", "감자에게 사과하세요", "화재경보기 울리기 직전"],
};

/** 감자 색 — 차이 d(초)에 따라 생감자 → 황금 → 갈색 → 숯. */
const STOPS: [number, string][] = [
  [-1.5, "#f1e6b8"], [-0.6, "#ecd28a"], [0, "#dd9f3f"], [0.6, "#a8622a"], [1.6, "#5e3820"], [3.0, "#2f241c"],
];
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function fryColor(d: number) {
  if (d <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [d1, c1] = STOPS[i];
    if (d > d1) continue;
    const [d0, c0] = STOPS[i - 1];
    const t = (d - d0) / (d1 - d0);
    const a = hex(c0), b = hex(c1);
    return `#${a.map((v, k) => Math.round(v + (b[k] - v) * t).toString(16).padStart(2, "0")).join("")}`;
  }
  return STOPS[STOPS.length - 1][1];
}

const verdictOf = (d: number): Verdict => (Math.abs(d) <= FRIES.perfectMs / 1000 ? "perfect" : d < 0 ? "under" : "over");
const signed = (d: number) => `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(2)}`;
const pad2 = (n: number) => String(n).padStart(2, "0");
const drawTarget = () => {
  const lo = Math.round(FRIES.targetMin * 10), hi = Math.round(FRIES.targetMax * 10);
  return (lo + Math.floor(Math.random() * (hi - lo + 1))) / 10;
};

type Rec = { name: string; t: number; d: number; ment: string };
type Phase = "setup" | "play" | "result";
type Fry = "ready" | "frying" | "lifted";

/**
 * 감자튀김 — 목표 시간(3.0~8.0초)을 뽑고, 휴대폰 한 대를 돌려 가며 한 명씩 「넣기」 → 목표다 싶을 때 「건지기」. 목표와 가장 가까운 사람이 이깁니다.
 * 타이머는 처음 1초만 보이고 「?.??」로 가립니다. 업소용 튀김기를 위에서 내려다본 모양 — 위 스테인리스 판(숫자판) · 기름통(바구니 + 감자 13개) · 아래 판(누르는 단추).
 */
export function FrenchFries() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [names, setNames] = useState(["나", "민지", "준호"]);
  const [target, setTarget] = useState(drawTarget);
  const [turn, setTurn] = useState(0);
  const [fry, setFry] = useState<Fry>("ready");
  const [recs, setRecs] = useState<Rec[]>([]);
  const [t0, setT0] = useState(0);
  const used = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);

  const players = names.map((n, i) => n.trim() || `참가자 ${i + 1}`);
  const last = recs[recs.length - 1];

  function begin(newTarget: boolean) {
    clear();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (newTarget) setTarget(drawTarget());
    used.current = new Set();
    setRecs([]);
    setTurn(0);
    setFry("ready");
    setPhase("play");
  }

  /** 건지는 순간 멘트를 정합니다 — 같은 판에서 나온 건 빼고, 묶음을 다 썼을 때만 다시. */
  function pickMent(d: number) {
    const v = verdictOf(d);
    const near = Math.abs(d) <= 0.3;
    const group = MENTS[v === "perfect" ? "perfect" : v === "under" ? (near ? "underNear" : "underFar") : near ? "overNear" : "overFar"];
    const fresh = group.filter((m) => !used.current.has(m));
    const pool = fresh.length ? fresh : group;
    const m = pool[Math.floor(Math.random() * pool.length)];
    used.current.add(m);
    return m;
  }

  // 같은 판 안에서 넣기 · 건지기가 겹치지 않게 지금 값을 잡아 둡니다.
  const live = useRef({ fry, turn, t0 });
  live.current = { fry, turn, t0 };

  function lift(at?: number) {
    const { fry: f, turn: i, t0: start } = live.current;
    if (f !== "frying") return;
    clear();
    const t = Math.round((at ?? (Date.now() - start) / 1000) * 100) / 100;
    const d = Math.round((t - target) * 100) / 100;
    const v = verdictOf(d);
    Haptics.notificationAsync(v === "perfect" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    setRecs((cur) => [...cur, { name: players[i], t, d, ment: pickMent(d) }]);
    setFry("lifted");
    live.current.fry = "lifted";
    if (i + 1 < players.length) setTurn(i + 1);
    else timers.current.push(setTimeout(() => setPhase("result"), RESULT_DELAY_MS));
  }

  function drop() {
    const { fry: f } = live.current;
    if (f === "frying" || recs.length >= players.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const now = Date.now();
    setT0(now);
    setFry("frying");
    live.current = { ...live.current, fry: "frying", t0: now };
    timers.current.push(setTimeout(() => lift(target + AUTO_LIFT_S), (target + AUTO_LIFT_S) * 1000));
  }

  const press = () => (fry === "frying" ? lift() : drop());

  if (phase === "setup") {
    return (
      <View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: F.serif, fontSize: 16, color: C.ink }}>이번 목표</Text>
          <View style={{ marginTop: 6, flexDirection: "row", alignItems: "baseline", gap: 4 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 52, color: C.ink, letterSpacing: -1 }}>{target.toFixed(2)}</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 16, color: C.muted }}>초</Text>
          </View>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setTarget(drawTarget()); }}
            accessibilityRole="button"
            style={{ marginTop: 8, height: 32, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}
          >
            <Text style={{ fontFamily: F.sansMd, fontSize: 12, color: C.muted }}>다시 뽑기</Text>
          </Pressable>
        </View>

        {/* 참가자 — 이름은 바로 고치고, − 로 빼고(2명까지), + 로 더합니다(8명까지). */}
        <Text style={{ marginTop: 22, fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, color: C.faint }}>참가자 {names.length}</Text>
        <View style={{ marginTop: 8, gap: 6 }}>
          {names.map((n, i) => (
            <View key={i} style={{ height: 42, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingLeft: 12, paddingRight: 6, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.faint }}>{pad2(i + 1)}</Text>
              <TextInput
                value={n}
                onChangeText={(t) => setNames((cur) => cur.map((x, k) => (k === i ? t.slice(0, NAME_LEN) : x)))}
                maxLength={NAME_LEN}
                placeholder={`참가자 ${i + 1}`}
                placeholderTextColor="#b3ada1"
                returnKeyType="done"
                style={{ flex: 1, height: "100%", fontFamily: F.serif, fontSize: 15, color: C.ink }}
              />
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setNames((cur) => cur.filter((_, k) => k !== i)); }}
                disabled={names.length <= MIN_PLAYERS}
                hitSlop={6}
                accessibilityLabel={`${players[i]} 빼기`}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#efebe2", alignItems: "center", justifyContent: "center", opacity: names.length <= MIN_PLAYERS ? 0.4 : 1 }}
              >
                <Text style={{ fontFamily: F.sansMd, fontSize: 14, lineHeight: 16, color: C.muted }}>−</Text>
              </Pressable>
            </View>
          ))}
          {names.length < MAX_PLAYERS && (
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setNames((cur) => [...cur, ""]); }}
              accessibilityRole="button"
              style={{ height: 40, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: C.brick, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontFamily: F.sansMd, fontSize: 12.5, color: C.brick }}>+ 한 명 더</Text>
            </Pressable>
          )}
        </View>

        {/* 판정 안내 — 칸마다 그 상태의 감자 색 막대. */}
        <View style={{ marginTop: 18, flexDirection: "row", gap: 6 }}>
          {([["under", fryColor(-0.6), "목표보다 일찍"], ["perfect", fryColor(0), `±${(FRIES.perfectMs / 1000).toFixed(2)}초`], ["over", fryColor(1.6), "목표보다 늦게"]] as const).map(([v, color, sub]) => (
            <View key={v} style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: C.lineSoft, backgroundColor: C.card, padding: 10, gap: 6 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: color }} />
              <Text style={{ fontFamily: F.sansMd, fontSize: 12, color: VERDICT[v].ink }}>{VERDICT[v].label}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 9.5, color: C.faint }}>{sub}</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={() => begin(false)} accessibilityRole="button" style={{ marginTop: 18, height: 48, borderRadius: 24, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: F.serif, fontSize: 15, color: C.card }}>시작하기</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "result") {
    const ranked = [...recs].sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
    const win = ranked[0];
    return (
      <View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: F.serif, fontSize: 16, color: C.brick }}>감자튀김 마스터</Text>
          <Text style={{ marginTop: 6, fontFamily: F.serif, fontSize: 30, color: C.ink }}>{win.name}</Text>
          <Text style={{ marginTop: 6, fontFamily: F.sans, fontSize: 12.5, color: C.muted }}>
            목표 {target.toFixed(2)}초에서 {Math.abs(win.d).toFixed(2)}초 차이
          </Text>
        </View>
        <View style={{ marginTop: 18, gap: 4 }}>
          {ranked.map((r, i) => (
            <View key={i} style={{ minHeight: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: i === 0 ? HI : "transparent" }}>
              <Text style={{ width: 18, fontFamily: F.mono, fontSize: 11, color: i === 0 ? C.brick : C.faint }}>{i + 1}</Text>
              <View style={{ width: 6, height: 24, borderRadius: 3, backgroundColor: fryColor(r.d) }} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.serif, fontSize: 15, color: C.ink }}>{r.name}</Text>
              <Text style={{ fontFamily: F.sansMd, fontSize: 11.5, color: VERDICT[verdictOf(r.d)].ink }}>{VERDICT[verdictOf(r.d)].label}</Text>
              <Text style={{ width: 52, textAlign: "right", fontFamily: F.mono, fontSize: 12, color: C.ink }}>{signed(r.d)}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 18, flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => begin(true)} accessibilityRole="button" style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: F.serif, fontSize: 14, color: C.card }}>한 판 더</Text>
          </Pressable>
          <Pressable onPress={() => { Haptics.selectionAsync(); setPhase("setup"); }} accessibilityRole="button" style={{ flex: 1, height: 46, borderRadius: 23, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: F.serif, fontSize: 14, color: C.ink }}>참가자 바꾸기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const finished = recs.length >= players.length;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.faint }}>{pad2(turn + 1)} / {pad2(players.length)}</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.brick }}>목표 {target.toFixed(2)}초</Text>
      </View>
      <Text style={{ marginTop: 4, fontFamily: F.serif, fontSize: 20, color: C.ink }}>{finished ? "다 튀겼어요" : `${players[turn]} 차례`}</Text>

      <Fryer
        fry={fry}
        t0={t0}
        shown={fry === "lifted" ? last?.t ?? 0 : 0}
        d={fry === "lifted" && last ? last.d : -9}
        disabled={finished}
        onPress={press}
      />

      {/* 기록 — 가장 최근 줄이 맨 위. */}
      {recs.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, color: C.faint }}>기록</Text>
          <View style={{ marginTop: 6, gap: 4 }}>
            {[...recs].reverse().map((r, i) => {
              const v = VERDICT[verdictOf(r.d)];
              return (
                <View key={recs.length - i} style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: i === 0 ? HI : "transparent" }}>
                  <View style={{ width: 6, alignSelf: "stretch", minHeight: 30, borderRadius: 3, backgroundColor: fryColor(r.d) }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                      <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.serif, fontSize: 14, color: C.ink }}>{r.name}</Text>
                      <Text style={{ fontFamily: F.sansMd, fontSize: 11, color: v.ink }}>{v.label}</Text>
                      <View style={{ flex: 1 }} />
                      <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>{r.t.toFixed(2)}</Text>
                      <Text style={{ width: 46, textAlign: "right", fontFamily: F.mono, fontSize: 11, color: C.ink }}>{signed(r.d)}</Text>
                    </View>
                    <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.muted }}>{r.ment}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

/** 숫자판 — 튀기는 동안만 따로 흘러가게 해서 튀김기 전체를 다시 그리지 않습니다. */
function Readout({ fry, t0, shown }: { fry: Fry; t0: number; shown: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (fry !== "frying") return;
    const id = setInterval(() => setNow(Date.now()), 33);
    return () => clearInterval(id);
  }, [fry]);
  const el = Math.max(0, (now - t0) / 1000);
  const text =
    fry === "lifted" ? shown.toFixed(2)
    : fry === "ready" ? "0.00"
    : FRIES.timer === "visible" || (FRIES.timer === "after1s" && el < 1) ? el.toFixed(2)
    : "?.??";
  return (
    <View style={{ minWidth: 118, borderRadius: 8, backgroundColor: "#14110e", paddingHorizontal: 12, paddingVertical: 6, alignItems: "flex-end", borderWidth: 1, borderColor: "#0a0907" }}>
      <Text style={{ fontFamily: F.mono, fontSize: 30, color: LED, textShadowColor: "rgba(255,138,31,.75)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } }}>{text}</Text>
    </View>
  );
}

/** 바구니 안 감자 13개 — 바구니 안쪽 기준 0~1 자리 · 길이 · 기울기. 한 번 정해 둡니다. */
const FRY_N = 13;
const BUBBLE_N = 18;
const VAT_H = 196;
const STEEL = "#cfccc4";
const STEEL_EDGE = "#b3afa6";

function Fryer({ fry, t0, shown, d, disabled, onPress }: {
  fry: Fry; t0: number; shown: number; d: number; disabled: boolean; onPress: () => void;
}) {
  const [w, setW] = useState(0);
  const fries = useMemo(() => Array.from({ length: FRY_N }, () => ({
    x: 0.14 + Math.random() * 0.72, y: 0.16 + Math.random() * 0.68,
    len: 0.32 + Math.random() * 0.16, rot: -70 + Math.random() * 140,
  })), []);
  const bubbles = useMemo(() => Array.from({ length: BUBBLE_N }, () => ({
    x: 0.06 + Math.random() * 0.88, y: 0.08 + Math.random() * 0.84, r: 2 + Math.random() * 4,
    ms: 700 + Math.random() * 700, delay: Math.random() * 900, v: new Animated.Value(0),
  })), []);

  const scale = useRef(new Animated.Value(1)).current;
  const cover = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const frying = fry === "frying";
    Animated.parallel([
      Animated.spring(scale, { toValue: frying ? 0.94 : fry === "lifted" ? 1.04 : 1, useNativeDriver: true, speed: 14, bounciness: 6 }),
      Animated.timing(cover, { toValue: frying ? 0.93 : 0, duration: frying ? 260 : 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    if (!frying) return;
    const loops = bubbles.map((b) => {
      b.v.setValue(0);
      return Animated.loop(Animated.sequence([
        Animated.delay(b.delay),
        Animated.timing(b.v, { toValue: 1, duration: b.ms, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(b.v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => { l.stop(); });
  }, [fry]); // eslint-disable-line react-hooks/exhaustive-deps

  const color = fryColor(d);
  const bw = Math.max(0, w - 56), bh = VAT_H - 40;
  const frying = fry === "frying";

  return (
    <View style={{ marginTop: 12, borderRadius: 18, backgroundColor: STEEL, borderWidth: 1, borderColor: STEEL_EDGE, overflow: "hidden" }}>
      {/* 위 스테인리스 판 — 검은 숫자판 */}
      <View style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: STEEL_EDGE, backgroundColor: "#dad7d0" }}>
        <View style={{ gap: 3 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1.5, color: "#6f6a61" }}>FRYER · 01</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: frying ? LED : "#8d887f" }} />
            <Text style={{ fontFamily: F.mono, fontSize: 9, color: "#6f6a61" }}>{frying ? "FRYING" : "READY"}</Text>
          </View>
        </View>
        <Readout fry={fry} t0={t0} shown={shown} />
      </View>

      {/* 기름통 — 눌러도 넣기 · 건지기 */}
      <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={frying ? "건지기" : "넣기"} style={{ margin: 10, height: VAT_H, borderRadius: 12, borderWidth: 3, borderColor: "#9e998f", overflow: "hidden" }}>
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flex: 1 }}>
          <Svg width="100%" height="100%" style={{ position: "absolute" }}>
            <Defs>
              <LinearGradient id="oil" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#f3b04c" />
                <Stop offset="1" stopColor="#d27a26" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#oil)" />
          </Svg>

          {w > 0 && (
            <Animated.View style={{
              position: "absolute", left: 28, top: 14, width: bw, height: bh, transform: [{ scale }],
              shadowColor: C.ink, shadowOpacity: fry === "lifted" ? 0.35 : 0, shadowRadius: 10, shadowOffset: { width: 0, height: 8 },
            }}>
              <Svg width={bw} height={bh + 22}>
                {/* 손잡이 — 앞(아래)으로 */}
                <Rect x={bw / 2 - 5} y={bh - 2} width={10} height={24} rx={3} fill="#2b2622" />
                <Rect x={0} y={0} width={bw} height={bh} rx={10} fill="rgba(60,52,44,.18)" stroke="#3a342d" strokeWidth={3} />
                {Array.from({ length: Math.floor(bw / 12) }, (_, i) => (
                  <Line key={`v${i}`} x1={(i + 1) * 12} y1={2} x2={(i + 1) * 12} y2={bh - 2} stroke="#3a342d" strokeOpacity={0.3} strokeWidth={1} />
                ))}
                {Array.from({ length: Math.floor(bh / 12) }, (_, i) => (
                  <Line key={`h${i}`} x1={2} y1={(i + 1) * 12} x2={bw - 2} y2={(i + 1) * 12} stroke="#3a342d" strokeOpacity={0.3} strokeWidth={1} />
                ))}
                {fries.map((f, i) => {
                  const L = f.len * bh, cx = f.x * bw, cy = f.y * bh;
                  return (
                    <G key={i} transform={`rotate(${f.rot} ${cx} ${cy})`}>
                      <Rect x={cx - 5} y={cy - L / 2} width={10} height={L} rx={3} fill={color} stroke="rgba(40,28,18,.25)" strokeWidth={1} />
                    </G>
                  );
                })}
              </Svg>
            </Animated.View>
          )}

          {/* 기름 덮개 — 넣으면 감자를 가립니다. */}
          <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, opacity: cover }}>
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="oilCover" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#f3b04c" />
                  <Stop offset="1" stopColor="#d27a26" />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width="100%" height="100%" fill="url(#oilCover)" />
            </Svg>
          </Animated.View>

          {/* 기포 */}
          {frying && w > 0 && bubbles.map((b, i) => (
            <Animated.View key={i} pointerEvents="none" style={{
              position: "absolute", left: b.x * w - b.r, top: b.y * VAT_H - b.r, width: b.r * 2, height: b.r * 2, borderRadius: b.r,
              borderWidth: 1, borderColor: "rgba(255,240,205,.9)", backgroundColor: "rgba(255,226,160,.35)",
              opacity: b.v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.9, 0] }),
              transform: [{ scale: b.v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.2] }) }],
            }} />
          ))}
        </View>
      </Pressable>

      {/* 아래 판 — 오른쪽에 누르는 단추 */}
      <View style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: STEEL_EDGE, backgroundColor: "#dad7d0" }}>
        <View style={{ gap: 3 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1.5, color: "#6f6a61" }}>OIL 175°C</Text>
          <Text style={{ fontFamily: F.mono, fontSize: 9, color: "#8d887f" }}>{frying ? "목표다 싶을 때" : "누르면 튀기기 시작"}</Text>
        </View>
        <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button">
          {({ pressed }) => (
            <View style={{
              width: 124, height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center",
              backgroundColor: frying ? C.brick : C.ink, opacity: disabled ? 0.45 : 1,
              borderBottomWidth: pressed ? 1 : 4, borderBottomColor: frying ? "#7d3a1e" : "#000000",
              transform: [{ translateY: pressed ? 3 : 0 }],
            }}>
              <Text style={{ fontFamily: F.serif, fontSize: 18, color: "#fbf3ec" }}>{frying ? "건지기" : "넣기"}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}
