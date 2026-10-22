import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Pressable, Text, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { C, F } from "@/theme";
import { HI, pad2, pickFresh, playerNames, Players } from "./party";

/** 한 사람이 그리는 시간 · 마지막 사람이 끝나고 결과로 넘어가기까지 · 그리는 판 좌표(정사각형 한 변). */
const DRAW_MS = 5000;
const RESULT_DELAY_MS = 2400;
const BOARD = 280;
const DOUGH = "#f0d9a6";
const CRUST = "#c99a52";

/** 채점 — 사용자 점 240개 · 정답 둘레 720개 · 각도 72칸. */
const USER_N = 240;
const SHAPE_N = 720;
const BINS = 72;

type Pt = [number, number];

/** 정답 모양 — 가운데가 0,0 쯤인 단위 좌표(아래가 +y), 똑바로 선 방향. 크기 · 위치는 채점에 상관없습니다. */
const ring = (n: number, f: (t: number) => Pt) => Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2));
const SHAPES = [
  { id: "circle", name: "동그란 피자", outline: ring(360, (t) => [Math.cos(t), Math.sin(t)]) },
  { id: "square", name: "네모 피자", outline: [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Pt[] },
  { id: "triangle", name: "세모 피자", outline: [[0, -1], [0.866, 0.5], [-0.866, 0.5]] as Pt[] },
  {
    id: "heart", name: "하트 피자",
    outline: ring(360, (t) => [Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]),
  },
  {
    id: "star", name: "별 피자",
    outline: Array.from({ length: 10 }, (_, i): Pt => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.42 : 1;
      return [r * Math.cos(a), r * Math.sin(a)];
    }),
  },
  // 얼굴 — 위가 조금 넓고 턱이 좁은 달걀꼴. 눈 · 입은 미리보기에만 그립니다.
  { id: "face", name: "얼굴 피자", outline: ring(360, (t) => [0.8 * Math.cos(t) * (1 - 0.14 * Math.sin(t)), Math.sin(t)]) },
] as const;
type Shape = (typeof SHAPES)[number];

/**
 * 멘트 — 점수대별 다섯 개씩. 시안(DINARY 감자튀김 게임.dc.html 「피자」 탭)의 PZ_MENTS 로 바꿔 넣을 자리입니다(지금은 임시 문구).
 */
const PZ_MENTS = {
  top: ["피자집 차려도 되겠어요", "도우 장인 납시오", "자로 잰 듯한 손끝", "이건 교과서 피자", "사장님 여기 한 판 더요"],
  good: ["꽤 그럴듯한 도우", "손님 받아도 되겠어요", "조금만 다듬으면 완벽", "모양은 확실히 알겠어요", "피자라고 부를 수 있어요"],
  meh: ["창작 피자인가요", "반죽이 살짝 도망갔어요", "뭔지 알 것도 같아요", "도우가 춤을 췄네요", "이건 시식용으로"],
  bad: ["도우가 찢어졌어요", "이건 그냥 부침개", "반죽이 바닥에 떨어졌어요", "피자보다 지도 같아요", "새 반죽 가져올게요"],
};
const mentGroup = (score: number) => PZ_MENTS[score >= 92 ? "top" : score >= 80 ? "good" : score >= 60 ? "meh" : "bad"];

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** 선 길이를 기준으로 고르게 n 개를 다시 뽑습니다(closed 면 끝 → 처음도 한 변). */
function resample(pts: readonly Pt[], n: number, closed: boolean): Pt[] {
  const P = closed ? [...pts, pts[0]] : [...pts];
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + dist(P[i - 1], P[i]));
  const total = cum[cum.length - 1];
  const step = total / (closed ? n : n - 1);
  const out: Pt[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const at = Math.min(total, k * step);
    while (j < P.length - 1 && cum[j] < at) j++;
    const seg = cum[j] - cum[j - 1] || 1;
    const t = (at - cum[j - 1]) / seg;
    out.push([P[j - 1][0] + (P[j][0] - P[j - 1][0]) * t, P[j - 1][1] + (P[j][1] - P[j - 1][1]) * t]);
  }
  return out;
}

const centroid = (pts: Pt[]): Pt => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
const binOf = (p: Pt, c: Pt) => {
  const a = Math.atan2(p[1] - c[1], p[0] - c[0]);
  return Math.floor(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * BINS) % BINS;
};

/** 정답 모양마다 둘레 720점 · 중심 · 칸마다 가장 먼 거리(tr) · 평균 거리를 미리 구해 둡니다. */
const TARGETS = Object.fromEntries(SHAPES.map((s) => {
  const pts = resample(s.outline, SHAPE_N, true);
  const c = centroid(pts);
  const tr = new Array<number>(BINS).fill(0);
  for (const p of pts) { const b = binOf(p, c); tr[b] = Math.max(tr[b], dist(p, c)); }
  const mean = pts.reduce((sum, p) => sum + dist(p, c), 0) / pts.length;
  return [s.id, { pts, c, tr, mean }];
})) as Record<Shape["id"], { pts: Pt[]; c: Pt; tr: number[]; mean: number }>;

/** 점수(0~100, 소수 첫째 자리)와 정답을 겹쳐 그릴 중심 · 크기. */
function grade(raw: Pt[], shape: Shape): { score: number; c: Pt; mean: number } {
  let len = 0;
  for (let i = 1; i < raw.length; i++) len += dist(raw[i - 1], raw[i]);
  if (raw.length < 6 || len < 90) return { score: 0, c: raw[0] ?? [BOARD / 2, BOARD / 2], mean: 0 };
  const u = resample(raw, USER_N, false);
  const c = centroid(u);
  const sum = new Array<number>(BINS).fill(0), cnt = new Array<number>(BINS).fill(0);
  for (const p of u) { const b = binOf(p, c); sum[b] += dist(p, c); cnt[b]++; }
  const T = TARGETS[shape.id];
  const bins = Array.from({ length: BINS }, (_, b) => b).filter((b) => cnt[b] > 0 && T.tr[b] > 0);
  const ur = bins.map((b) => sum[b] / cnt[b]), tr = bins.map((b) => T.tr[b]);
  const mu = ur.reduce((a, b) => a + b, 0) / ur.length, mt = tr.reduce((a, b) => a + b, 0) / tr.length;
  const err = bins.length ? ur.reduce((a, r, i) => a + Math.abs(r / mu - tr[i] / mt), 0) / bins.length : 1;
  const coverK = Math.min(1, bins.length / BINS / 0.92) ** 2;
  const mean = u.reduce((a, p) => a + dist(p, c), 0) / u.length;
  const gap = dist(u[0], u[u.length - 1]) / mean;
  const gapK = gap > 0.2 ? Math.max(0.6, 1 - (gap - 0.2) * 0.5) : 1;
  const score = Math.max(0, 100 * (1 - err * 3) * coverK * gapK);
  return { score: Math.round(score * 10) / 10, c, mean };
}

const pathOf = (pts: readonly Pt[], closed: boolean) =>
  pts.length ? `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")}${closed ? " Z" : ""}` : "";

const drawShape = (not?: Shape) => {
  const pool = SHAPES.filter((s) => s.id !== not?.id);
  return pool[Math.floor(Math.random() * pool.length)];
};

type Rec = { name: string; score: number; pts: Pt[]; c: Pt; mean: number; ment: string };
type Phase = "setup" | "play" | "result";
type Draw = "ready" | "drawing" | "done";

/**
 * 피자 도우 펴기 — 모양 하나(동그라미 · 네모 · 세모 · 하트 · 별 · 얼굴)를 뽑고, 휴대폰 한 대를 돌려 가며 한 명씩 한 붓에 그립니다.
 * 판에 손가락을 대면 5초가 줄기 시작하고, 떼거나 5초가 지나면 그 사람은 끝. 크기 · 위치와 상관없이 모양이 가장 비슷한 사람이 이깁니다.
 * 그리는 동안은 onTouch 로 화면 세로 스크롤을 멈춥니다(지도와 같은 방식).
 */
export function PizzaDough({ names, setNames, onTouch }: {
  names: string[]; setNames: Dispatch<SetStateAction<string[]>>; onTouch?: (touching: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [shape, setShape] = useState<Shape>(() => drawShape());
  const [turn, setTurn] = useState(0);
  const [draw, setDraw] = useState<Draw>("ready");
  const [recs, setRecs] = useState<Rec[]>([]);
  const [pts, setPts] = useState<Pt[]>([]);
  const [t0, setT0] = useState(0);
  const [w, setW] = useState(0);
  const used = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => { clear(); onTouch?.(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const players = playerNames(names);
  const last = recs[recs.length - 1];
  const finished = recs.length >= players.length;

  // 손가락 이벤트 사이에서 지금 값을 잡아 둡니다.
  const live = useRef({ draw, turn, pts: [] as Pt[] });
  live.current.draw = draw;
  live.current.turn = turn;

  function begin(next?: Shape) {
    clear();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (next) setShape(next);
    used.current = new Set();
    setRecs([]);
    setPts([]);
    setTurn(0);
    setDraw("ready");
    setPhase("play");
  }

  function finish() {
    const { draw: d, turn: i, pts: raw } = live.current;
    if (d !== "drawing") return;
    clear();
    live.current.draw = "done";
    const g = grade(raw, shape);
    Haptics.notificationAsync(g.score >= 80 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    setRecs((cur) => [...cur, { name: players[i], score: g.score, pts: raw, c: g.c, mean: g.mean, ment: pickFresh(mentGroup(g.score), used.current) }]);
    setDraw("done");
    if (i + 1 < players.length) setTurn(i + 1);
    else timers.current.push(setTimeout(() => setPhase("result"), RESULT_DELAY_MS));
  }

  const at = (e: GestureResponderEvent): Pt => {
    const k = w ? BOARD / w : 1;
    return [Math.max(0, Math.min(BOARD, e.nativeEvent.locationX * k)), Math.max(0, Math.min(BOARD, e.nativeEvent.locationY * k))];
  };
  function grant(e: GestureResponderEvent) {
    if (live.current.draw === "drawing" || recs.length >= players.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const p = at(e);
    live.current = { ...live.current, draw: "drawing", pts: [p] };
    setPts([p]);
    setT0(Date.now());
    setDraw("drawing");
    timers.current.push(setTimeout(finish, DRAW_MS));
  }
  function move(e: GestureResponderEvent) {
    if (live.current.draw !== "drawing") return;
    const p = at(e), cur = live.current.pts;
    if (dist(p, cur[cur.length - 1]) < 1.5) return;
    live.current.pts = [...cur, p];
    setPts(live.current.pts);
  }

  if (phase === "setup") {
    return (
      <View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: F.serif, fontSize: 16, color: C.ink }}>이번 모양</Text>
          <View style={{ marginTop: 12 }}><ShapeIcon shape={shape} size={76} /></View>
          <Text style={{ marginTop: 10, fontFamily: F.serif, fontSize: 24, color: C.ink }}>{shape.name}</Text>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setShape(drawShape(shape)); }}
            accessibilityRole="button"
            style={{ marginTop: 8, height: 32, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}
          >
            <Text style={{ fontFamily: F.sansMd, fontSize: 12, color: C.muted }}>다시 뽑기</Text>
          </Pressable>
          <Text style={{ marginTop: 14, fontFamily: F.sans, fontSize: 12.5, lineHeight: 19, color: C.muted, textAlign: "center" }}>
            한 붓에 5초 안에 그려요. 손가락을 떼면 끝나고,{"\n"}모양과 가장 비슷하게 편 사람이 이겨요.
          </Text>
        </View>

        <Players names={names} setNames={setNames} />

        <Pressable onPress={() => begin()} accessibilityRole="button" style={{ marginTop: 18, height: 48, borderRadius: 24, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: F.serif, fontSize: 15, color: C.card }}>시작하기</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "result") {
    const ranked = [...recs].sort((a, b) => b.score - a.score);
    const win = ranked[0];
    return (
      <View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: F.serif, fontSize: 16, color: C.brick }}>피자 장인</Text>
          <Text style={{ marginTop: 6, fontFamily: F.serif, fontSize: 30, color: C.ink }}>{win.name}</Text>
          <Text style={{ marginTop: 6, fontFamily: F.sans, fontSize: 12.5, color: C.muted }}>{shape.name} · {win.score.toFixed(1)}점</Text>
        </View>
        <View style={{ marginTop: 18, gap: 4 }}>
          {ranked.map((r, i) => (
            <View key={i} style={{ minHeight: 48, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: i === 0 ? HI : "transparent" }}>
              <Text style={{ width: 18, fontFamily: F.mono, fontSize: 11, color: i === 0 ? C.brick : C.faint }}>{i + 1}</Text>
              <Thumb pts={r.pts} size={32} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.serif, fontSize: 15, color: C.ink }}>{r.name}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.ink }}>{r.score.toFixed(1)}점</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 18, flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => begin(drawShape(shape))} accessibilityRole="button" style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: F.serif, fontSize: 14, color: C.card }}>한 판 더</Text>
          </Pressable>
          <Pressable onPress={() => { Haptics.selectionAsync(); setPhase("setup"); }} accessibilityRole="button" style={{ flex: 1, height: 46, borderRadius: 23, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: F.serif, fontSize: 14, color: C.ink }}>설정 바꾸기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 끝난 사람의 도우 + 정답 모양(그 사람 중심 · 크기에 맞춰 벽돌색 점선).
  const shown = draw === "done" && last;
  const T = TARGETS[shape.id];
  const guide = shown && last.mean > 0
    ? pathOf(T.pts.filter((_, i) => i % 4 === 0).map((p): Pt => [last.c[0] + (p[0] - T.c[0]) * (last.mean / T.mean), last.c[1] + (p[1] - T.c[1]) * (last.mean / T.mean)]), true)
    : "";
  const hint = finished ? "곧 결과가 나와요" : recs.length ? "판을 누르면 다음 사람이 시작해요" : "판을 누르고 한 붓에 그리세요";

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.faint }}>{pad2(turn + 1)} / {pad2(players.length)}</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.brick }}>{shape.name}</Text>
      </View>
      <Text style={{ marginTop: 4, fontFamily: F.serif, fontSize: 20, color: C.ink }}>{finished ? "다 폈어요" : `${players[turn]} 차례`}</Text>

      <Countdown drawing={draw === "drawing"} t0={t0} />

      {/* 반죽 판 — 손가락으로 한 붓에. 안쪽 그림자는 가장자리 그라데이션으로. */}
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        onTouchStart={() => onTouch?.(true)}
        onTouchEnd={() => onTouch?.(false)}
        onTouchCancel={() => onTouch?.(false)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={grant}
        onResponderMove={move}
        onResponderRelease={finish}
        onResponderTerminate={finish}
        accessibilityLabel="반죽 판"
        style={{ marginTop: 12, width: "100%", aspectRatio: 1, borderRadius: 16, overflow: "hidden", backgroundColor: "#e6d8bd" }}
      >
        <View pointerEvents="none" style={{ flex: 1 }}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${BOARD} ${BOARD}`}>
            <Defs>
              {(["t", "b", "l", "r"] as const).map((k) => (
                <LinearGradient key={k} id={`in${k}`} x1={k === "l" ? "0" : k === "r" ? "1" : "0"} y1={k === "t" ? "0" : k === "b" ? "1" : "0"} x2={k === "l" ? "1" : k === "r" ? "0" : "0"} y2={k === "t" ? "1" : k === "b" ? "0" : "0"}>
                  <Stop offset="0" stopColor="#6b5530" stopOpacity={0.22} />
                  <Stop offset="1" stopColor="#6b5530" stopOpacity={0} />
                </LinearGradient>
              ))}
            </Defs>
            <Rect x={0} y={0} width={BOARD} height={14} fill="url(#int)" />
            <Rect x={0} y={BOARD - 8} width={BOARD} height={8} fill="url(#inb)" />
            <Rect x={0} y={0} width={10} height={BOARD} fill="url(#inl)" />
            <Rect x={BOARD - 10} y={0} width={10} height={BOARD} fill="url(#inr)" />
            {draw === "drawing" && (
              <>
                <Path d={pathOf(pts, false)} fill="none" stroke={CRUST} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
                <Path d={pathOf(pts, false)} fill="none" stroke={DOUGH} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
            {shown && (
              <>
                <Path d={pathOf(last.pts, true)} fill={DOUGH} stroke={CRUST} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
                {!!guide && <Path d={guide} fill="none" stroke={C.brick} strokeWidth={2} strokeDasharray="6 5" />}
              </>
            )}
          </Svg>
        </View>
        {shown && (
          <View pointerEvents="none" style={{ position: "absolute", top: 10, right: 10, borderRadius: 12, backgroundColor: C.brick, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 14, color: "#fbf3ec" }}>{last.score.toFixed(1)}점</Text>
          </View>
        )}
      </View>
      <Text style={{ marginTop: 10, textAlign: "center", fontFamily: F.sans, fontSize: 12, color: C.faint }}>{draw === "drawing" ? " " : hint}</Text>

      {/* 기록 — 가장 최근 줄이 맨 위. */}
      {recs.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, color: C.faint }}>기록</Text>
          <View style={{ marginTop: 6, gap: 4 }}>
            {[...recs].reverse().map((r, i) => (
              <View key={recs.length - i} style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: i === 0 ? HI : "transparent" }}>
                <Thumb pts={r.pts} size={28} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.serif, fontSize: 14, color: C.ink }}>{r.name}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.ink }}>{r.score.toFixed(1)}점</Text>
                  </View>
                  <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.muted }}>{r.ment}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

/** 남은 시간 「5.0」 + 줄어드는 막대 — 그리는 동안만 따로 흘러가게. 1.5초 아래면 벽돌색. */
function Countdown({ drawing, t0 }: { drawing: boolean; t0: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!drawing) return;
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, [drawing]);
  const left = drawing ? Math.max(0, Math.min(DRAW_MS, DRAW_MS - (now - t0))) / 1000 : DRAW_MS / 1000;
  return (
    <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={{ width: 34, fontFamily: F.mono, fontSize: 16, color: left < 1.5 ? C.brick : C.ink }}>{left.toFixed(1)}</Text>
      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: "#ece6da", overflow: "hidden" }}>
        <View style={{ width: `${(left / (DRAW_MS / 1000)) * 100}%`, height: "100%", borderRadius: 3, backgroundColor: C.brick }} />
      </View>
    </View>
  );
}

/** 그린 모양 썸네일 — 크기에 맞춰 가운데로. */
function Thumb({ pts, size }: { pts: Pt[]; size: number }) {
  if (pts.length < 2) return <View style={{ width: size, height: size, borderRadius: 6, backgroundColor: "#ece6da" }} />;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), bw = Math.max(...xs) - x0, bh = Math.max(...ys) - y0;
  const k = (size - 6) / Math.max(bw, bh, 1);
  const fit = pts.map((p): Pt => [(p[0] - x0) * k + (size - bw * k) / 2, (p[1] - y0) * k + (size - bh * k) / 2]);
  return (
    <Svg width={size} height={size}>
      <Path d={pathOf(fit, true)} fill={DOUGH} stroke={CRUST} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}

/** 모양 미리보기 — 도우 색. 얼굴은 눈 · 입을 얹습니다. */
function ShapeIcon({ shape, size }: { shape: Shape; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="-1.2 -1.2 2.4 2.4">
      <Path d={pathOf(shape.outline, true)} fill={DOUGH} stroke={CRUST} strokeWidth={0.09} strokeLinejoin="round" />
      {shape.id === "face" && (
        <>
          <Circle cx={-0.28} cy={-0.18} r={0.09} fill={CRUST} />
          <Circle cx={0.28} cy={-0.18} r={0.09} fill={CRUST} />
          <Path d="M-0.3 0.3 Q0 0.55 0.3 0.3" fill="none" stroke={CRUST} strokeWidth={0.08} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}
