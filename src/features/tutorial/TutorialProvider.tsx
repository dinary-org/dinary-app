import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { Dimensions } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { STEPS, TUTORIAL_KEYS, type Step, type TutorialKey } from "./steps";

/**
 * 첫 실행 튜토리얼 — 자리(ref) 등록부, 지금 보이는 튜토리얼 · 단계, 본 기록(AsyncStorage `tutorial.seen.<key>`).
 * 화면은 useTutorialTarget(id) 로 자리를 등록하고 useTabTutorial(key) 로 처음 들어왔을 때 띄워 달라고 합니다.
 * 그림은 뿌리의 CoachOverlay 가 그립니다.
 */

type Measurable = { measureInWindow(cb: (x: number, y: number, w: number, h: number) => void): void };
export type Hole = { x: number; y: number; w: number; h: number; r: number };
type Active = { key: TutorialKey; index: number };

type Ctx = {
  active: Active | null;
  step: Step | null;
  /** 구멍(창 좌표). 처음 재는 중이면 null. 단계가 막 바뀌면 다 잴 때까지 앞 단계 것이 남습니다(그 사이 움직임이 이어지게). */
  holes: Hole[] | null;
  /** holes 가 지금 단계를 잰 것인지 — 아니면 글을 아직 그리지 않습니다. */
  fresh: boolean;
  /** 지금 단계가 몇 번째인지(intro · outro 빼고 셈). */
  number: { n: number; of: number } | null;
  last: boolean;
  next: () => void;
  close: () => void;
};
/** 자주 안 바뀌는 쪽 — 자리를 등록하는 화면들이 단계마다 다시 그려지지 않게 따로 둡니다. */
type Registry = {
  register: (id: string, node: Measurable | null) => void;
  want: (key: TutorialKey, on: boolean) => void;
  restart: () => void;
};

const TutorialCtx = createContext<Ctx | null>(null);
const RegistryCtx = createContext<Registry | null>(null);
const storeKey = (k: TutorialKey) => `tutorial.seen.${k}`;

const measure = (node: Measurable) =>
  new Promise<{ x: number; y: number; w: number; h: number } | null>((resolve) => {
    // 스크롤 아래(화면 밖)에 있는 자리는 없는 셈 — 그 단계는 건너뜁니다.
    const H = Dimensions.get("window").height;
    try { node.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 && y < H - 40 && y + h > 40 ? { x, y, w, h } : null)); } catch { resolve(null); }
  });

/** enabled — 로그인 · 닉네임까지 끝나고 부팅 화면이 걷혔을 때만 띄웁니다. couple — 연인 기록장이면 단계 글을 연인용으로. */
export function TutorialProvider({ enabled, couple, children }: { enabled: boolean; couple: boolean; children: ReactNode }) {
  const router = useRouter();
  const targets = useRef(new Map<string, Measurable>());
  const [seen, setSeen] = useState<Set<TutorialKey> | null>(null);
  // 한 화면이 둘을 바랄 수 있어(지도: 지도 → 연인) 바란 순서대로 줄을 세웁니다.
  const [wanted, setWanted] = useState<TutorialKey[]>([]);
  const [active, setActive] = useState<Active | null>(null);
  const [measured, setMeasured] = useState<{ at: Active; holes: Hole[] } | null>(null);
  const holes = measured?.holes ?? null;

  useEffect(() => {
    void AsyncStorage.multiGet(TUTORIAL_KEYS.map(storeKey))
      .then((pairs) => setSeen(new Set(TUTORIAL_KEYS.filter((_, i) => pairs[i]?.[1]))))
      .catch(() => setSeen(new Set()));
  }, []);

  const coupleRef = useRef(couple);
  useEffect(() => { coupleRef.current = couple; }, [couple]);
  const markSeen = useCallback((k: TutorialKey) => {
    // 연인 기록장에서 본 지도 튜토리얼은 「다른 탭」에서 연인 탭까지 짚으니, 연인 안내도 본 것으로.
    const keys: TutorialKey[] = k === "map" && coupleRef.current ? ["map", "couple"] : [k];
    setSeen((s) => { const n = new Set(s ?? []); keys.forEach((x) => n.add(x)); return n; });
    keys.forEach((x) => void AsyncStorage.setItem(storeKey(x), "1").catch(() => {}));
  }, []);

  // 처음 들어온 화면의 튜토리얼 — 다른 튜토리얼(특히 지도)이 떠 있으면 띄우지 않습니다.
  useEffect(() => {
    const key = wanted.find((k) => !seen?.has(k));
    if (!enabled || !seen || !key || active) return;
    setActive({ key, index: 0 });
  }, [enabled, seen, wanted, active]);
  const want = useCallback((key: TutorialKey, on: boolean) => {
    setWanted((l) => (on ? (l.includes(key) ? l : [...l, key]) : l.filter((k) => k !== key)));
  }, []);

  const close = useCallback(() => {
    setActive((a) => { if (a) markSeen(a.key); return null; });
    setMeasured(null);
  }, [markSeen]);

  const next = useCallback(() => {
    setActive((a) => {
      if (!a) return a;
      if (a.index + 1 >= STEPS[a.key].length) { markSeen(a.key); return null; }
      return { key: a.key, index: a.index + 1 };
    });
  }, [markSeen]);

  const base = active ? STEPS[active.key][active.index] : null;
  const step = useMemo(() => (base && couple && base.couple ? { ...base, ...base.couple } : base), [base, couple]);

  // 단계가 바뀔 때마다 자리를 잽니다. 시트처럼 막 움직인 자리가 있어 조금 뒤 한 번 더 잽니다.
  useEffect(() => {
    if (!active || !step) return;
    let dead = false;
    const run = async (final: boolean) => {
      if (!step.targets.length) return setMeasured({ at: active, holes: [] });
      const rects = (await Promise.all(step.targets.map((id) => {
        const node = targets.current.get(id);
        return node ? measure(node) : Promise.resolve(null);
      }))).filter((r): r is NonNullable<typeof r> => !!r);
      if (dead) return;
      // 꼭 보여야 하는 단계(지도 빈 곳)는 못 쟀으면 화면 가운데 원으로 대신합니다.
      if (!rects.length && step.fallback) {
        const { width, height } = Dimensions.get("window");
        const d = step.fallback.size;
        rects.push({ x: (width - d) / 2, y: height * step.fallback.y, w: d, h: d });
      }
      // 자리가 하나도 없으면(연인 기록장이라 칸이 없는 경우 등) 그 단계는 건너뜁니다.
      if (!rects.length) { if (final) next(); return; }
      setMeasured({ at: active, holes: rects.map((r) => {
        const b = step.box ? { x: r.x + (r.w - step.box.w) / 2, y: r.y + (r.h - step.box.h) / 2, w: step.box.w, h: step.box.h } : r;
        return { ...b, r: step.radius === "circle" ? Math.min(b.w, b.h) / 2 : step.radius ?? 16 };
      }) });
    };
    void run(false);
    const t = setTimeout(() => void run(true), 350);
    return () => { dead = true; clearTimeout(t); };
  }, [active, step, next]);

  const restart = useCallback(() => {
    void AsyncStorage.multiRemove(TUTORIAL_KEYS.map(storeKey)).catch(() => {});
    setSeen(new Set());
    setActive(null);
    setMeasured(null);
    // 지도 탭에 들어가면 지도 튜토리얼이 처음부터 뜹니다.
    router.navigate("/");
  }, [router]);

  const register = useCallback((id: string, node: Measurable | null) => {
    if (node) targets.current.set(id, node);
    else targets.current.delete(id);
  }, []);

  const value = useMemo<Ctx>(() => {
    const list = active ? STEPS[active.key] : [];
    const counted = list.filter((s) => !s.kind);
    const number = active && step && !step.kind ? { n: list.slice(0, active.index + 1).filter((s) => !s.kind).length, of: counted.length } : null;
    const fresh = !!measured && measured.at === active;
    return { active, step, holes, fresh, number, last: !!active && active.index === list.length - 1, next, close };
  }, [active, step, holes, measured, next, close]);
  const registry = useMemo<Registry>(() => ({ register, want, restart }), [register, want, restart]);

  return (
    <RegistryCtx.Provider value={registry}>
      <TutorialCtx.Provider value={value}>{children}</TutorialCtx.Provider>
    </RegistryCtx.Provider>
  );
}

/** 지금 단계 — 뿌리의 CoachOverlay 처럼 단계마다 다시 그려져도 되는 곳에서만. */
export function useTutorial() {
  const ctx = useContext(TutorialCtx);
  if (!ctx) throw new Error("useTutorial needs <TutorialProvider>");
  return ctx;
}

/** 「튜토리얼 다시 보기」 — 본 기록을 모두 지우고 지도 튜토리얼부터 다시. */
export function useRestartTutorial() {
  return useContext(RegistryCtx)?.restart ?? noop;
}
const noop = () => {};

/** 튜토리얼 구멍이 뚫릴 자리 — 돌려받은 ref 를 그 View(Pressable · Animated.View) 에 붙입니다. */
export function useTutorialTarget(id: string) {
  const register = useContext(RegistryCtx)?.register;
  return useCallback((node: Measurable | null) => register?.(id, node), [register, id]);
}

/**
 * 이 화면에 처음 들어오면(포커스) 레이아웃이 자리 잡을 때를 기다렸다가 그 튜토리얼을 한 번 띄웁니다.
 * ready 가 false 인 동안(그 화면의 다른 안내 창이 떠 있을 때 등)은 기다립니다.
 */
export function useTabTutorial(key: TutorialKey, delay = 300, ready = true) {
  const want = useContext(RegistryCtx)?.want;
  useFocusEffect(useCallback(() => {
    if (!want || !ready) return;
    const t = setTimeout(() => want(key, true), delay);
    return () => { clearTimeout(t); want(key, false); };
  }, [want, key, delay, ready]));
}
