import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import { Text } from "@/components/Text";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { useAccount } from "@/data/profile";
import { usePersonalRows, usePersonalWishes } from "@/data/queries";
import { A, CLOCK_END, ClockProvider } from "@/features/recap/anim";
import { computeRecap } from "@/features/recap/compute";
import { currentQuarter, parseQuarter, quarterLabel, seasonOf } from "@/features/recap/seasons";
import {
  Cover, Districts, Labels, Memo, Next, Numbers, Odd, Persona, ShareCard, shareThemes, Taste, Time, Top5, TopPlaceSlide, WishSlide,
  type Layout, type SlideProps,
} from "@/features/recap/slides";
import { useRecapState } from "@/features/recap/useRecapState";
import { C, F } from "@/theme";

/** 한 장이 머무는 시간(초) — 시제품 기본값. */
const SECONDS = 6;
/** 이보다 짧게 눌렀다 떼면 탭, 길면 멈춤 */
const TAP_MS = 250;
const NEEDS_BUILD = "새 개발 빌드가 필요해요";
/** 장마다 아래에 깔리는 저장·공유 줄이 차지하는 높이 — 장 내용은 이만큼 위로 줄여 그립니다. */
const BAR = 64;

/**
 * 공유 카드에만 쓰는 네이티브 모듈은 누를 때 불러옵니다 — expo-sharing 은 불러오는 순간 네이티브 모듈을 찾아서,
 * 이 모듈이 없는 예전 빌드에서는 위에서 import 하면 앱이 시작하자마자 멈춥니다. 없으면 null.
 */
function shareModules() {
  try {
    const { captureRef } = require("react-native-view-shot") as typeof import("react-native-view-shot");
    const Sharing = require("expo-sharing") as typeof import("expo-sharing");
    return { captureRef, Sharing };
  } catch {
    return null;
  }
}

/** view-shot 은 불러올 때가 아니라 부를 때 네이티브 모듈이 없다고 던집니다. */
const missingNative = (e: unknown) => e instanceof Error && /RNViewShot|native module/i.test(e.message);

type SlideDef = { id: string; dark: boolean; render: () => React.ReactNode };

/**
 * 분기 리캡 재생기 — HANDOFF quarterly recap §1. 스토리처럼 장마다 6초씩 넘어가고,
 * 오른쪽 70% 를 누르면 다음·왼쪽 30% 는 이전, 길게 누르면 멈춥니다. 데이터가 없는 장은 건너뜁니다.
 */
export default function RecapPlayer() {
  const { quarter = "" } = useLocalSearchParams<{ quarter: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const { data: rows, dataUpdatedAt: rowsAt } = usePersonalRows();
  const { data: wishes, dataUpdatedAt: wishesAt } = usePersonalWishes();
  const { data: account } = useAccount();
  const recapState = useRecapState();

  const valid = !!parseQuarter(quarter) && quarter < currentQuarter();
  const { data: recap, isPending } = useQuery({
    queryKey: ["recap", quarter, rowsAt, wishesAt],
    queryFn: () => computeRecap(rows ?? [], wishes ?? [], quarter),
    enabled: valid && !!rows && !!wishes,
  });

  const season = valid ? seasonOf(quarter) : null;
  const nick = account?.nickname?.trim() || "나";
  const scale = Math.min(1, (H - BAR) / 844);
  const L: Layout = useMemo(
    () => ({ y: (mt: number) => Math.round(insets.top + Math.max(0, mt - 44) * scale), bottom: insets.bottom + BAR, scale }),
    [insets.top, insets.bottom, scale]
  );

  const cardRef = useRef<View>(null);
  const slideRef = useRef<View>(null);
  const [themeIdx, setThemeIdx] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const openRecord = useCallback((id: number) => router.replace({ pathname: "/record/[id]", params: { id: String(id) } }), [router]);
  const directions = useCallback((q: string) => { Linking.openURL(`https://map.naver.com/p/search/${encodeURIComponent(q)}`).catch(() => {}); }, []);

  const [play, setPlay] = useState({ i: 0, n: 0 });

  const slides: SlideDef[] = useMemo(() => {
    if (!recap || !season) return [];
    const p: SlideProps = { data: recap, season, nick, L };
    const list: (SlideDef | null)[] = [
      { id: "cover", dark: true, render: () => <Cover {...p} /> },
      { id: "numbers", dark: false, render: () => <Numbers {...p} /> },
      recap.labels.earned.length || recap.labels.near.length ? { id: "labels", dark: false, render: () => <Labels {...p} /> } : null,
      { id: "top", dark: true, render: () => <TopPlaceSlide {...p} /> },
      recap.top5 ? { id: "top5", dark: false, render: () => <Top5 {...p} /> } : null,
      recap.districts ? { id: "districts", dark: true, render: () => <Districts {...p} /> } : null,
      { id: "taste", dark: false, render: () => <Taste {...p} /> },
      { id: "time", dark: true, render: () => <Time {...p} /> },
      { id: "persona", dark: false, render: () => <Persona {...p} /> },
      recap.memo ? { id: "memo", dark: true, render: () => <Memo {...p} onOpen={openRecord} /> } : null,
      recap.wish ? { id: "wish", dark: false, render: () => <WishSlide {...p} onDirections={directions} /> } : null,
      recap.odd ? { id: "odd", dark: false, render: () => <Odd {...p} /> } : null,
      recap.next ? { id: "next", dark: true, render: () => <Next {...p} /> } : null,
      { id: "share", dark: false, render: () => null },
    ];
    return list.filter((x): x is SlideDef => !!x);
  }, [recap, season, nick, L, openRecord, directions]);

  const last = slides.length - 1;
  const cur = Math.min(play.i, Math.max(0, last));

  /* ── 시계 · 진행 ─────────────────────────────── */

  const clock = useSharedValue(0);
  const prog = useSharedValue(0);

  const advance = useCallback(() => setPlay((p) => (p.i < last ? { i: p.i + 1, n: p.n + 1 } : p)), [last]);

  const run = useCallback(
    (fromClock: number, fromProg: number) => {
      clock.value = fromClock;
      clock.value = withTiming(CLOCK_END, { duration: Math.max(0, CLOCK_END - fromClock), easing: Easing.linear });
      prog.value = fromProg;
      prog.value = withTiming(1, { duration: Math.max(0, (1 - fromProg) * SECONDS * 1000), easing: Easing.linear }, (done) => {
        if (done) scheduleOnRN(advance);
      });
    },
    [clock, prog, advance]
  );

  const pause = () => {
    cancelAnimation(clock);
    cancelAnimation(prog);
  };
  const resume = () => run(clock.value, prog.value);

  // 장이 바뀔 때마다 처음부터 — 등장 애니메이션을 다시 틀고 진행 막대를 0 에서 채웁니다.
  useEffect(() => {
    if (!slides.length) return;
    run(0, 0);
    if (cur === last) recapState.markSeen(quarter);
    return () => {
      cancelAnimation(clock);
      cancelAnimation(prog);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play.n, slides.length]);

  const go = (i: number) => {
    if (i < 0) i = 0;
    if (i > last) return resume(); // 마지막 장에서 다음은 그대로 머뭅니다.
    Haptics.selectionAsync();
    setPlay((p) => ({ i, n: p.n + 1 }));
  };

  const downAt = useRef(0);
  const onPressIn = () => {
    downAt.current = Date.now();
    pause();
  };
  const onPressOut = (e: GestureResponderEvent) => {
    if (Date.now() - downAt.current < TAP_MS) go(e.nativeEvent.pageX < W * 0.3 ? cur - 1 : cur + 1);
    else resume();
  };

  /* ── 저장 · 공유 ─────────────────────────────── */

  /**
   * 지금 장을 PNG 로 — 마지막 장은 공유 카드만, 나머지는 장 전체. 찍는 동안 멈추고 등장 애니메이션을
   * 끝까지 돌려 둔 채로 찍은 뒤 다시 흘려 보냅니다.
   */
  async function withCapture(mods: NonNullable<ReturnType<typeof shareModules>>, then: (uri: string) => Promise<void>) {
    const target = slides[cur]?.id === "share" ? cardRef : slideRef;
    pause();
    clock.value = CLOCK_END;
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await then(await mods.captureRef(target, { format: "png", quality: 1, result: "tmpfile" }));
    } finally {
      resume();
    }
  }

  async function shareSlide() {
    const mods = shareModules();
    if (!mods) return setToast(NEEDS_BUILD);
    try {
      if (!(await mods.Sharing.isAvailableAsync())) return setToast("이 기기에서는 공유할 수 없어요");
      await withCapture(mods, (uri) => mods.Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "리캡 공유" }));
    } catch (e) {
      setToast(missingNative(e) ? NEEDS_BUILD : "이미지를 만들지 못했어요");
    }
  }

  async function saveSlide() {
    const mods = shareModules();
    if (!mods) return setToast(NEEDS_BUILD);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) return setToast("사진 접근을 허용하면 저장할 수 있어요");
      await withCapture(mods, (uri) => MediaLibrary.saveToLibraryAsync(uri));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setToast("사진 앱에 저장했어요");
    } catch (e) {
      setToast(missingNative(e) ? NEEDS_BUILD : "이미지를 저장하지 못했어요");
    }
  }

  /* ── 화면 ─────────────────────────────── */

  const close = () => router.back();

  if (!valid || (!isPending && !recap) || !season) {
    return (
      <View style={[s.root, { backgroundColor: C.paper, alignItems: "center", justifyContent: "center", padding: 28 }]}>
        <StatusBar style="dark" />
        <Text style={{ fontFamily: F.serif, fontSize: 20, color: C.ink, textAlign: "center" }}>이 분기의 리캡이 없어요</Text>
        <Text style={{ marginTop: 8, fontFamily: F.sans, fontSize: 13, color: C.faint, textAlign: "center" }}>
          기록이 한 건도 없는 분기는 리캡이 만들어지지 않아요.
        </Text>
        <Pressable onPress={close} style={{ marginTop: 20, borderRadius: 20, backgroundColor: C.ink, paddingVertical: 12, paddingHorizontal: 22 }}>
          <Text style={{ fontFamily: F.sansMd, fontSize: 13.5, color: C.card }}>닫기</Text>
        </Pressable>
      </View>
    );
  }

  if (!recap || !slides.length) return <View style={[s.root, { backgroundColor: season.deep }]} />;

  const slide = slides[cur];
  const chrome = slide.dark ? C.card : C.ink;
  const shareH = Math.max(340, Math.min(470, H - L.y(112) - (insets.bottom + 10) - 110 - 24 - 60));
  const themes = shareThemes(season);
  const isShare = slide.id === "share";

  return (
    <ClockProvider value={clock}>
      <StatusBar style={slide.dark ? "light" : "dark"} />
      <Pressable style={s.root} onPressIn={onPressIn} onPressOut={onPressOut} accessible={false}>
        <View key={`${slide.id}-${play.n}`} ref={slideRef} collapsable={false} style={StyleSheet.absoluteFill}>
          {isShare ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#e9e5da" }]}>
              <A k="card" d={100} style={[{ position: "absolute", top: L.y(112), left: 30, right: 30 }, s.cardShadow]}>
                <View ref={cardRef} collapsable={false}>
                  <ShareCard data={recap} season={season} nick={nick} L={L} height={shareH} theme={themes[themeIdx]} />
                </View>
              </A>
              <A k="up" d={400} style={{ position: "absolute", top: L.y(112) + shareH + 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 4 }}>
                {themes.map((t, i) => {
                  const selected = i === themeIdx;
                  return (
                    <Pressable
                      key={t.name}
                      onPress={() => { Haptics.selectionAsync(); setThemeIdx(i); }}
                      accessibilityLabel={i === 0 ? `카드 색 · ${t.name}` : t.name}
                      accessibilityState={{ selected }}
                      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
                    >
                      <View style={selected ? s.swatchRing : undefined}>
                        <View style={[s.swatch, { backgroundColor: t.bg }, !selected && { borderWidth: 1, borderColor: "rgba(28,26,23,.15)" }]} />
                      </View>
                    </Pressable>
                  );
                })}
              </A>
            </View>
          ) : (
            slide.render()
          )}
        </View>

        {/* 저장(작게) · 공유(길게) — 모든 장. 마지막 장에는 「처음부터 보기」가 한 줄 더 붙습니다. */}
        <View style={{ position: "absolute", left: isShare ? 30 : 24, right: isShare ? 30 : 24, bottom: insets.bottom + 10, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={saveSlide}
              accessibilityLabel="이미지 저장"
              style={({ pressed }) => [s.saveBtn, slide.dark ? s.saveDark : s.saveLight, pressed && { opacity: 0.7 }]}
            >
              <DownloadIcon color={chrome} />
            </Pressable>
            <Pressable
              onPress={shareSlide}
              style={({ pressed }) => [s.shareMain, { flex: 1, backgroundColor: slide.dark ? C.card : C.ink }, pressed && { opacity: 0.85 }]}
            >
              <Text style={{ fontFamily: F.sansMd, fontSize: 14, color: slide.dark ? C.ink : C.card }}>{isShare ? "스토리에 공유" : "공유하기"}</Text>
            </Pressable>
          </View>
          {isShare && (
            <Pressable onPress={() => go(0)} style={({ pressed }) => [s.shareSub, pressed && { backgroundColor: "#f1ede4" }]}>
              <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.ink }}>처음부터 보기</Text>
            </Pressable>
          )}
        </View>

        {/* 진행 막대 · DINARY · ✕ */}
        <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 6, left: 16, right: 16, gap: 12 }}>
          <View pointerEvents="none" style={{ flexDirection: "row", gap: 3 }}>
            {slides.map((sl, i) => (
              <Segment key={sl.id} state={i < cur ? "past" : i === cur ? "current" : "future"} prog={prog} color={chrome} />
            ))}
          </View>
          <View pointerEvents="box-none" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 6 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2.2, color: chrome }}>DINARY · {quarterLabel(quarter)}</Text>
            <Pressable onPress={close} hitSlop={14} accessibilityLabel="리캡 닫기">
              <Text style={{ fontSize: 16, color: chrome }}>✕</Text>
            </Pressable>
          </View>
        </View>

        {toast && (
          <View pointerEvents="none" style={[s.toast, { bottom: insets.bottom + 140 }]}>
            <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: C.card }}>{toast}</Text>
          </View>
        )}
      </Pressable>
    </ClockProvider>
  );
}

function DownloadIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />
    </Svg>
  );
}

function Segment({ state, prog, color }: { state: "past" | "current" | "future"; prog: SharedValue<number>; color: string }) {
  const fill = useAnimatedStyle(() => ({
    width: `${(state === "past" ? 1 : state === "current" ? prog.value : 0) * 100}%`,
  }));
  return (
    <View style={{ flex: 1, height: 3 }}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: 2, backgroundColor: color, opacity: 0.25 }]} />
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: color }, fill]} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  cardShadow: { shadowColor: "#1c1a17", shadowOpacity: 0.2, shadowRadius: 40, shadowOffset: { width: 0, height: 18 }, elevation: 12, borderRadius: 26 },
  shareMain: { height: 52, borderRadius: 26, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  saveBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  saveLight: { borderColor: "#cdc6b8", backgroundColor: C.card },
  saveDark: { borderColor: "rgba(251,250,246,.35)", backgroundColor: "rgba(251,250,246,.08)" },
  shareSub: {
    height: 48, borderRadius: 24, borderWidth: 1, borderColor: "#cdc6b8", backgroundColor: C.card, alignItems: "center", justifyContent: "center",
  },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  swatchRing: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: "#1c1a17", alignItems: "center", justifyContent: "center" },
  toast: {
    position: "absolute", alignSelf: "center", borderRadius: 16, backgroundColor: "rgba(23,22,20,.85)", paddingVertical: 10, paddingHorizontal: 16,
  },
});
