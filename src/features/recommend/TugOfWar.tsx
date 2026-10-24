import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, View, type GestureResponderEvent } from "react-native";
import { Text } from "@/components/Text";
import { C, F } from "@/theme";
import { REC, type GameOption } from "./ui";

/** 한 번 칠 때 매듭이 움직이는 몫(끝까지 1) · 3-2-1 간격 · 이만큼 지나면 앞선 쪽이 이깁니다. */
const STEP = 1 / 14;
const COUNT_MS = 800;
const LIMIT_MS = 15000;
/** 두 사람 색 — 벽돌 · 남색. */
const SIDES = [
  { ink: C.brick, soft: C.brickSoft, name: "왼쪽" },
  { ink: REC.here, soft: "#e3eaee", name: "오른쪽" },
] as const;

type Phase = "idle" | "count" | "go" | "done";

/**
 * 줄다리기 — 두 사람이 먹고 싶은 것을 하나씩 고르고, 3-2-1 뒤 제 칸을 빨리 두드립니다. 한 번 칠 때마다 가운데 매듭이 내 쪽으로 옵니다.
 * 매듭을 끝까지 끌어오면 이기고, 15초가 지나면 앞선 쪽이 이깁니다(똑같으면 다음 한 번이 결판). 결과는 미리 뽑지 않습니다.
 * 두 손가락이 동시에 눌러도 다 세도록 Pressable(응답자 하나만) 대신 onTouchStart 로 셉니다.
 */
export function TugOfWar({ options, busy, onStart, onDone }: {
  options: GameOption[]; busy: boolean;
  onStart: () => void; onDone: (o: GameOption) => void;
}) {
  const n = options.length;
  const ready = n >= 2;
  const [pick, setPick] = useState<[number, number]>([0, 1]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(3);
  const [taps, setTaps] = useState<[number, number]>([0, 0]);
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const [left, setLeft] = useState(LIMIT_MS / 1000);
  const [w, setW] = useState(0);
  const [sudden, setSudden] = useState(false);

  const pos = useRef(0); // -1 = 왼쪽 승, 1 = 오른쪽 승
  const knot = useRef(new Animated.Value(0)).current;
  const live = useRef({ phase, sudden: false });
  live.current.phase = phase;
  const timers = useRef<ReturnType<typeof setTimeout | typeof setInterval>[]>([]);
  const clear = () => { timers.current.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers.current = []; };
  useEffect(() => clear, []);

  // 칸이 바뀌면 처음으로 — 고른 두 칸도 앞의 둘로.
  const sig = options.map((o) => o.key).join("|");
  useEffect(() => {
    clear();
    pos.current = 0;
    knot.setValue(0);
    live.current.sudden = false;
    setPick([0, Math.min(1, Math.max(0, n - 1))]);
    setPhase("idle");
    setTaps([0, 0]);
    setWinner(null);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 다른 쪽이 고른 칸은 건너뛰며 앞뒤로 넘깁니다. */
  const cycle = (side: 0 | 1, dir: 1 | -1) => {
    Haptics.selectionAsync();
    setPick((cur) => {
      const other = cur[1 - side];
      let i = cur[side];
      do i = (i + dir + n) % n; while (i === other);
      const next: [number, number] = [...cur];
      next[side] = i;
      return next;
    });
  };

  const finish = (side: 0 | 1) => {
    clear();
    setPhase("done");
    live.current.phase = "done";
    setWinner(side);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone(options[pick[side]]);
  };

  function start() {
    if (!ready || busy || phase === "count" || phase === "go") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clear();
    pos.current = 0;
    knot.setValue(0);
    live.current.sudden = false;
    setTaps([0, 0]);
    setWinner(null);
    setSudden(false);
    setLeft(LIMIT_MS / 1000);
    setCount(3);
    setPhase("count");
    onStart();
    [2, 1].forEach((c, i) => timers.current.push(setTimeout(() => { setCount(c); Haptics.selectionAsync(); }, COUNT_MS * (i + 1))));
    timers.current.push(setTimeout(() => {
      setPhase("go");
      live.current.phase = "go";
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const t0 = Date.now();
      timers.current.push(setInterval(() => setLeft(Math.max(0, Math.ceil((LIMIT_MS - (Date.now() - t0)) / 1000))), 250));
      timers.current.push(setTimeout(() => {
        if (pos.current === 0) { live.current.sudden = true; setSudden(true); }
        else finish(pos.current < 0 ? 0 : 1);
      }, LIMIT_MS));
    }, COUNT_MS * 3));
  }

  const pull = (side: 0 | 1) => (e: GestureResponderEvent) => {
    if (live.current.phase !== "go") return;
    const k = Math.max(1, e.nativeEvent.changedTouches?.length ?? 1);
    Haptics.selectionAsync();
    setTaps((cur) => { const next: [number, number] = [...cur]; next[side] += k; return next; });
    if (live.current.sudden) return finish(side);
    pos.current = Math.max(-1, Math.min(1, pos.current + (side === 0 ? -STEP : STEP) * k));
    Animated.spring(knot, { toValue: pos.current, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
    if (Math.abs(pos.current) >= 1) finish(side);
  };

  const half = Math.max(0, w / 2 - 14);
  const running = phase === "count" || phase === "go";

  const picker = (side: 0 | 1) => {
    const s = SIDES[side];
    const o = options[pick[side]];
    return (
      <View style={{ flex: 1, height: 40, borderRadius: 20, flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: s.ink, backgroundColor: winner === side ? s.soft : C.card }}>
        <Pressable onPress={() => cycle(side, -1)} disabled={running || n < 3} hitSlop={6} accessibilityLabel={`${s.name} 사람 이전 칸`} style={{ width: 30, height: "100%", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: F.sansMd, fontSize: 14, color: n < 3 ? C.faint : s.ink }}>‹</Text>
        </Pressable>
        <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", fontFamily: F.sansBd, fontSize: 13, color: s.ink }}>{o?.label ?? "—"}</Text>
        <Pressable onPress={() => cycle(side, 1)} disabled={running || n < 3} hitSlop={6} accessibilityLabel={`${s.name} 사람 다음 칸`} style={{ width: 30, height: "100%", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: F.sansMd, fontSize: 14, color: n < 3 ? C.faint : s.ink }}>›</Text>
        </Pressable>
      </View>
    );
  };

  const pad = (side: 0 | 1) => {
    const s = SIDES[side];
    const on = phase === "go";
    return (
      <View
        onTouchStart={pull(side)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${options[pick[side]]?.label ?? ""} 당기기`}
        style={{ flex: 1, height: 150, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: on ? s.ink : s.soft, borderWidth: 1.5, borderColor: s.ink, opacity: phase === "done" && winner !== side ? 0.45 : 1 }}
      >
        <Text style={{ fontFamily: F.sansBd, fontSize: 22, color: on ? "#fbf3ec" : s.ink }}>{on ? "당겨!" : phase === "done" && winner === side ? "승리" : "연타"}</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: on ? "#fbf3ec" : s.ink }}>{taps[side]}</Text>
      </View>
    );
  };

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {picker(0)}
        <Text style={{ fontFamily: F.serif, fontSize: 13, color: C.muted }}>vs</Text>
        {picker(1)}
      </View>

      {/* 줄 — 가운데 매듭이 이기는 쪽으로 끌려갑니다. 양 끝 깃발까지 오면 끝. */}
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginTop: 18, height: 44, justifyContent: "center" }}>
        <View style={{ position: "absolute", left: 0, top: 10, width: 4, height: 24, borderRadius: 2, backgroundColor: SIDES[0].ink }} />
        <View style={{ position: "absolute", right: 0, top: 10, width: 4, height: 24, borderRadius: 2, backgroundColor: SIDES[1].ink }} />
        <View style={{ position: "absolute", left: w / 2 - 0.5, top: 6, width: 1, height: 32, backgroundColor: C.line }} />
        <View style={{ marginHorizontal: 6, height: 5, borderRadius: 2.5, backgroundColor: "#c8ab83" }} />
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute", left: w / 2 - 14, top: 8, width: 28, height: 28, borderRadius: 14,
            backgroundColor: C.ink, borderWidth: 3, borderColor: REC.paper, alignItems: "center", justifyContent: "center",
            transform: [{ translateX: knot.interpolate({ inputRange: [-1, 1], outputRange: [-half, half] }) }],
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: REC.accent }} />
        </Animated.View>
      </View>

      <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
        {pad(0)}
        {pad(1)}
      </View>

      <View style={{ marginTop: 14, alignItems: "center", minHeight: 44, justifyContent: "center" }}>
        {phase === "count" ? (
          <Text style={{ fontFamily: F.sansBd, fontSize: 30, color: C.ink }}>{count}</Text>
        ) : phase === "go" ? (
          <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.muted }}>{sudden ? "동점! 먼저 치는 쪽이 이겨요" : `${left}초`}</Text>
        ) : (
          <Pressable
            onPress={start}
            disabled={!ready || busy}
            accessibilityRole="button"
            style={{ height: 44, borderRadius: 22, paddingHorizontal: 22, justifyContent: "center", backgroundColor: ready ? C.ink : "#a8a196" }}
          >
            <Text style={{ fontFamily: F.serif, fontSize: 14, color: REC.paper }}>{phase === "done" ? "한 판 더" : "대결 시작"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
