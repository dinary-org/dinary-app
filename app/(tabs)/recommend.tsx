import { useSession } from "@/data/session";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { ANDROID_TEXT, Text } from "@/components/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { MapPinIcon } from "@/components/icons";
import { useActiveBook, useRecordNotes } from "@/data/books";
import { useRows, useWishes } from "@/data/queries";
import { setState, useAppState } from "@/data/store";
import { useMyTours, useRecCandidates, useRecCourses, useRecHere, useRecPlaces, useRecWeather } from "@/features/recommend/api";
import { BrowseMode } from "@/features/recommend/BrowseMode";
import { FilterSheet } from "@/features/recommend/FilterSheet";
import { uuid, type RecSession } from "@/features/recommend/log";
import { NowMode } from "@/features/recommend/NowMode";
import { PointSheet } from "@/features/recommend/PointSheet";
import { RandomGames } from "@/features/recommend/RandomGames";
import { REC } from "@/features/recommend/ui";
import { todayIso } from "@/lib/anniversary";
import { REC_CONFIG } from "@/lib/rec/config";
import { recommend } from "@/lib/rec/pipeline";
import { resultSignature } from "@/lib/rec/snapshot";
import { mealSlotOf, seoulClock } from "@/lib/rec/time";
import { defaultFilter, FETCH_MAX_M, REC_MODE_LABEL, type RecCategory, type RecFilter, type RecMode } from "@/lib/recommend";
import type { Restaurant, Wish } from "@/lib/types";
import { C, F, TAB_BAR_H } from "@/theme";

const EMPTY_ROWS: Restaurant[] = [];
const EMPTY_WISHES: Wish[] = [];

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
/** 「토 15:02」 — 오늘이 아니면 「토 10.18 15:00」. */
const whenLabel = (d: Date, today: Date) =>
  `${DAYS[d.getDay()]}${d.toDateString() === today.toDateString() ? "" : ` ${d.getMonth() + 1}.${d.getDate()}`} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** 「지금 뭐 먹지」 — Dinary 인증 숫자는 10km 안을 한 번에 받아 두고(내 위시 · 단골 대체까지), 카카오 후보는 1.5km → 3km. */
const NOW_FETCH_M = FETCH_MAX_M;
/** 「다시 가는 사람이 많은 곳」 둘레. */
const BROWSE_M = 3000;

/**
 * 추천 탭(HANDOFF-recommend-all §4, 시안 v2 5a–5b) — 한 화면 안에서 「지금 뭐 먹지 / 둘러보기 / 랜덤 게임」을 오갑니다.
 * 랜덤 게임의 「추천된 가게」는 지금 뭐 먹지와 같은 5곳이라, 카카오 후보 · 날씨는 둘러보기에서만 쉽니다.
 * 남의 기록은 서버가 숫자로만 돌려주고(사진 · 사람 없음), 셈에는 인증된 기록만 씁니다.
 */
export default function RecommendTab() {
  const insets = useSafeAreaInsets();
  const { isCouple, id: bookId } = useActiveBook();
  const { data: notes } = useRecordNotes();
  const { data: rows = EMPTY_ROWS } = useRows();
  const { data: wishes = EMPTY_WISHES } = useWishes();
  const { recFilter, recPlace, recAt } = useAppState();
  const today = todayIso();

  const [mode, setMode] = useState<RecMode>("now");
  const [sheet, setSheet] = useState(false);
  const [pointSheet, setPointSheet] = useState(false);
  // 지도를 만지는 동안은 화면 세로 스크롤을 멈춥니다 — 지도 끌기 · 확대가 스크롤에 먹히지 않게.
  const [mapTouch, setMapTouch] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // 기준 = 머리에서 고른 자리 · 시각, 없으면 지금 위치 · 지금 시각.
  const { here: gps, denied } = useRecHere(rows);
  const here = recPlace ?? gps;
  const at = recAt;
  const custom = !!recPlace || !!recAt;
  const nowQ = useRecPlaces(here, NOW_FETCH_M, at);
  const browseQ = useRecPlaces(mode === "browse" ? here : null, BROWSE_M);
  const { data: courses = [] } = useRecCourses(mode === "browse" ? here : null, at);
  const { data: tours = [] } = useMyTours();

  // 필터 — 기본은 비어 있습니다(사용자가 고른 강한 조건만). 바꾼 값은 그 날만.
  const defaults = useMemo(() => defaultFilter(), []);
  const filter: RecFilter = useMemo(
    () => (recFilter?.date === today ? { inc: recFilter.inc, exc: recFilter.exc } : defaults),
    [recFilter, today, defaults]
  );
  const applyFilter = (f: RecFilter) => {
    setState({ recFilter: { ...f, date: today } });
    setSheet(false);
  };

  // 카카오 후보 1.5km, 모자라다고 하면 3km. 날씨는 없으면 중립.
  const [near, wide] = REC_CONFIG.radii;
  const picksOn = mode !== "browse";
  const kakaoNear = useRecCandidates(picksOn ? here : null, near);
  const [wantWide, setWantWide] = useState(false);
  const kakaoWide = useRecCandidates(picksOn ? here : null, wide, wantWide);
  const { data: weather = null } = useRecWeather(picksOn ? here : null);

  // 「다시 추천」 — 앞서 보여 준 5곳들. 기준(자리 · 시각 · 필터 · 기록장)이 바뀌면 처음부터.
  const [shown, setShown] = useState<string[][]>([]);
  const [explorationSeed] = useState(uuid);
  const basis = `${here?.lat.toFixed(3)},${here?.lng.toFixed(3)}|${at ?? "now"}|${JSON.stringify(filter)}|${bookId}`;
  useEffect(() => { setShown([]); setWantWide(false); }, [basis]);
  // 보고 있는 카드 — 새 5곳이 오면 첫 장부터.
  const [pickIndex, setPickIndex] = useState(0);

  const when = useMemo(() => (at ? new Date(at) : clock), [at, clock]);
  const seoul = seoulClock(when);
  const timeBasis = `${seoul.date}|${seoul.dow}|${mealSlotOf(seoul.minutes)}`;
  // 3km 결과는 칸이 커서 가까운 곳이 성기니 1.5km 결과와 합칩니다(같은 가게는 buildPool 이 하나로).
  const kakaoData = useMemo(() => {
    const parts = [kakaoNear.data, kakaoWide.data].filter((d): d is NonNullable<typeof d> => !!d);
    if (!parts.length) return null;
    return { candidates: parts.flatMap((d) => d.candidates), radius: Math.max(...parts.map((d) => d.radius)), partial: parts.some((d) => d.partial) };
  }, [kakaoNear.data, kakaoWide.data]);
  const kakaoState: "ok" | "partial" | "unavailable" | "loading" =
    kakaoData ? (kakaoData.partial ? "partial" : "ok") : kakaoNear.isError ? "unavailable" : "loading";
  const result = useMemo(() => {
    if (!here) return null;
    return recommend({
      here, at: when, filter, couple: isCouple, bookId,
      kakao: kakaoData?.candidates ?? [], kakaoRadius: kakaoData?.radius ?? null,
      stats: nowQ.data ?? [], rows, wishes, notes: isCouple ? notes : undefined, weather, avoid: shown.flat(),
      explorationSeed: REC_CONFIG.exploration.enabled ? `${explorationSeed}|${basis}|${shown.length}` : undefined,
    });
    // 시계(30초)마다 다시 고르지 않게 분 단위가 아닌 기준 시각만 봅니다.
  }, [here, at, timeBasis, filter, isCouple, bookId, kakaoData, nowQ.data, rows, wishes, notes, weather, shown, explorationSeed, basis]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (result?.wantRadius === wide) setWantWide(true); }, [result?.wantRadius, wide]);

  // A book/context/feature change starts a fresh immutable logging snapshot, even with the same picks.
  const pickSig = result ? resultSignature(result, `${basis}|${!!recPlace}|${!!recAt}|${kakaoState}|${here?.name ?? ""}|${shown.length}`) : "";
  const ownerId = useSession()?.user.id;
  const session: RecSession | null = useMemo(
    () => (result && pickSig && ownerId ? {
      id: uuid(), ownerId, bookId, result,
      meta: { area: here?.name ?? null, customPoint: !!recPlace, customTime: !!recAt, refresh: shown.length, kakao: kakaoState === "loading" ? "unavailable" : kakaoState },
    } : null),
    [pickSig, ownerId] // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => { setPickIndex(0); }, [session?.id]);

  /** 랜덤 게임에서 고른 가게 · 카테고리 — 지금 뭐 먹지로 넘어가 맨 위(카드)를 보여 줍니다. */
  const showNow = () => { setMode("now"); scrollRef.current?.scrollTo({ y: 0, animated: false }); };
  const playPlace = (i: number) => { if (i >= 0) setPickIndex(i); showNow(); };
  const playCategory = (cat: RecCategory) => { setState({ recFilter: { inc: [cat], exc: filter.exc.filter((x) => x !== cat), date: today } }); showNow(); };

  // 점심 · 저녁 — 오늘 그 끼니 시각(12:00 · 18:30)으로 기준 시각을 옮깁니다. 지금이 그 끼니면 지금으로.
  const slotNow = mealSlotOf(seoulClock(clock).minutes);
  const setMeal = (m: "lunch" | "dinner") => {
    if (m === slotNow) return setState({ recAt: null });
    const d = new Date(`${seoulClock(clock).date}T${m === "lunch" ? "12:00" : "18:30"}:00+09:00`);
    setState({ recAt: d.getTime() });
  };

  const revisits = useMemo(() => (browseQ.data ?? []).filter((s) => s.kind === "restaurant").slice(0, 10), [browseQ.data]);

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 22 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2.2, color: REC.label }}>RECOMMEND</Text>
          <Pressable
            onPress={() => setPointSheet(true)}
            accessibilityRole="button"
            accessibilityLabel="추천 기준 위치 · 시각 바꾸기"
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={{ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 13, paddingHorizontal: custom ? 9 : 0, paddingVertical: custom ? 4 : 0, backgroundColor: custom ? C.brickSoft : "transparent" }}
          >
            <MapPinIcon size={12} stroke={C.brick} strokeWidth={2} />
            <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.sans, fontSize: 11, color: custom ? C.brick : C.muted }}>
              {[here?.name, whenLabel(at ? new Date(at) : clock, clock)].filter(Boolean).join(" · ")}
            </Text>
            <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={custom ? C.brick : C.muted} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M6 9l6 6 6-6" />
            </Svg>
          </Pressable>
        </View>
        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "baseline", gap: 12 }}>
          {(Object.keys(REC_MODE_LABEL) as RecMode[]).map((m) => (
            <ModeTitle key={m} label={REC_MODE_LABEL[m]} on={mode === m} onPress={() => { Haptics.selectionAsync(); setMode(m); }} />
          ))}
        </View>
        {denied && !recPlace && here?.fallback && (
          <Pressable onPress={() => Linking.openSettings()} style={{ marginTop: 10, borderRadius: 14, backgroundColor: REC.noteBg, paddingVertical: 9, paddingHorizontal: 12 }}>
            <Text style={{ fontFamily: F.sans, fontSize: 11.5, lineHeight: 17, color: REC.noteInk }}>
              위치 권한이 없어 자주 기록한 {here.name} 기준으로 골랐어요. 설정에서 위치를 허용하면 지금 있는 곳 둘레로 찾아요 ›
            </Text>
          </Pressable>
        )}
        {denied && !recPlace && !here && (
          <Pressable onPress={() => Linking.openSettings()} style={{ marginTop: 10, borderRadius: 14, backgroundColor: REC.noteBg, paddingVertical: 9, paddingHorizontal: 12 }}>
            <Text style={{ fontFamily: F.sans, fontSize: 11.5, lineHeight: 17, color: REC.noteInk }}>
              위치 권한이 필요해요. 설정에서 위치를 허용해 주세요 ›
            </Text>
          </Pressable>
        )}
      </View>

      {/* 게임의 입력칸(칸 더하기 · 참가자 이름)이 키보드에 가리지 않게 — iOS 는 스크롤 여백, 안드로이드는 키보드만큼 줄입니다. */}
      <KeyboardAvoidingView behavior={Platform.OS === "android" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingTop: 14, paddingHorizontal: 22, paddingBottom: TAB_BAR_H + insets.bottom + 18 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!mapTouch}
      >
        {mode === "now" ? (
          <NowMode
            here={here}
            result={result}
            session={session}
            loading={nowQ.isLoading || kakaoState === "loading" || (wantWide && kakaoWide.isLoading)}
            error={nowQ.isError && kakaoState === "unavailable"}
            kakao={kakaoState}
            filter={filter}
            slot={result?.ctx.slot ?? slotNow}
            pointLabel={recPlace ? "고른 위치" : "내 위치"}
            index={pickIndex}
            onIndex={setPickIndex}
            onMapTouch={setMapTouch}
            onOpenFilter={() => setSheet(true)}
            onChangeFilter={(f) => setState({ recFilter: { ...f, date: today } })}
            onRefresh={() => result && setShown((s) => [...s, result.picks.map((p) => p.c.key)])}
            onMeal={setMeal}
            onRetry={() => { void nowQ.refetch(); void kakaoNear.refetch(); }}
          />
        ) : mode === "games" ? (
          <RandomGames picks={result?.picks ?? []} exclude={filter.exc} onPlace={playPlace} onCategory={playCategory} onDrawTouch={setMapTouch} />
        ) : (
          <BrowseMode courses={courses} tours={tours} revisits={revisits} />
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <PointSheet
        visible={pointSheet}
        gps={gps}
        place={recPlace}
        at={recAt}
        onClose={() => setPointSheet(false)}
        onApply={(place, when) => { setState({ recPlace: place, recAt: when }); setPointSheet(false); }}
      />
      <FilterSheet visible={sheet} value={filter} defaults={defaults} onClose={() => setSheet(false)} onApply={applyFilter} />
    </View>
  );
}

/**
 * 모드 이름 — 고른 쪽은 28 진하게, 아닌 쪽은 16 연하게. 제자리에서 0.3s 로 커지고 작아집니다(§4-1-1).
 * 고운돋움은 Regular 하나뿐이라 같은 글자를 THICK 만큼 옆으로 밀어 한 번 더 겹쳐 조금 굵게 보이게 합니다(fontWeight 는 iOS 에서 듣지 않음).
 */
const THICK = 0.7;

function ModeTitle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const t = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: on ? 1 : 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: false }).start();
  }, [on, t]);
  const style = {
    fontFamily: F.serif,
    fontSize: t.interpolate({ inputRange: [0, 1], outputRange: [16, 28] }),
    color: t.interpolate({ inputRange: [0, 1], outputRange: [REC.quiet, REC.ink] }),
  };
  return (
    <Pressable onPress={onPress} disabled={on} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} hitSlop={8}>
      <Animated.Text style={[ANDROID_TEXT, style]}>{label}</Animated.Text>
      <Animated.Text
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[ANDROID_TEXT, style, { position: "absolute", left: THICK, top: 0 }]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
}
