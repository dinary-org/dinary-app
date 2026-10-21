import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewToken } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Eyebrow } from "@/components/ui";
import { useActiveBook, useAnniversaryPicks } from "@/data/books";
import { useAccount } from "@/data/profile";
import { useRows, useWishes } from "@/data/queries";
import AnniversaryBanner from "@/features/couple/AnniversaryBanner";
import RecapCard from "@/features/recap/RecapCard";
import RecapListSheet from "@/features/recap/RecapListSheet";
import { useRecapState, useRecaps } from "@/features/recap/useRecapState";
import { dayCount, milestoneOn } from "@/lib/anniversary";
import { pinColor, type Restaurant, type Wish } from "@/lib/types";
import { C, F } from "@/theme";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** 연도 다이얼 범위(HANDOFF-calendar-nav §3) */
const YEARS = Array.from({ length: 16 }, (_, i) => 2020 + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i);
const ROW = 40;
const monthOfKey = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return { year: y, month: m - 1 };
};

/** 위아래로 넘기는 달 목록 — 다이얼과 같은 범위(2020.1 ~ 2035.12). */
const ALL_MONTHS = YEARS.flatMap((year) => MONTHS.map((month) => ({ year, month })));
const monthIndex = (c: { year: number; month: number }) =>
  Math.max(0, Math.min(ALL_MONTHS.length - 1, (c.year - YEARS[0]) * 12 + c.month));
/** 달 머리(「10월」) 높이 · 한 주 줄 높이 · 하루에 보이는 이름 수. 높이가 정해져 있어야 원하는 달로 바로 넘어갑니다. */
const MONTH_HEAD = 44;
const WEEK_H = 70;
const MAX_ITEMS = 3;
/** 그 달의 주 — 앞뒤 빈칸은 null. 달마다 필요한 만큼(4~6주)만. */
function monthWeeks(year: number, month: number) {
  const lead = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) =>
    i < lead || i >= lead + days ? null : new Date(year, month, i - lead + 1));
  const out: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
  return out;
}
const MONTH_LAYOUT = (() => {
  let offset = 0;
  return ALL_MONTHS.map(({ year, month }) => {
    const length = MONTH_HEAD + monthWeeks(year, month).length * WEEK_H;
    const at = { length, offset };
    offset += length;
    return at;
  });
})();

function groupBy<T extends { name: string }>(list: T[], key: (t: T) => string | null) {
  const map = new Map<string, T[]>();
  for (const r of list) {
    const k = key(r);
    if (!k) continue;
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  for (const l of map.values()) l.sort((a, b) => (a.name < b.name ? -1 : 1));
  return map;
}

/**
 * 연·월 다이얼 — 굴리는 동안은 가운데 강조만 바뀌고, 항목을 눌러야 onPick 으로 적용됩니다.
 * 처음부터 contentOffset 으로 현재 값을 가운데에 둡니다.
 */
function Dial({ labels, index, onPick }: { labels: string[]; index: number; onPick: (i: number) => void }) {
  const [center, setCenter] = useState(index);
  return (
    <View style={{ height: ROW * 5, borderRadius: 15, overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", top: ROW * 2, height: ROW, left: 6, right: 6, borderRadius: 10, backgroundColor: C.brickSoft }} />
      <ScrollView
        contentOffset={{ x: 0, y: index * ROW }}
        contentContainerStyle={{ paddingVertical: ROW * 2 }}
        snapToInterval={ROW}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setCenter(Math.max(0, Math.min(labels.length - 1, Math.round(e.nativeEvent.contentOffset.y / ROW))))}
      >
        {labels.map((label, i) => (
          <Pressable key={label} onPress={() => onPick(i)} style={{ height: ROW, alignItems: "center", justifyContent: "center" }}>
            <Text style={i === center
              ? { fontFamily: F.serif, fontSize: 18, fontWeight: "700", color: C.brick }
              : { fontFamily: F.serif, fontSize: 15, color: C.faint }}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** 이름 한 줄 — 앞에 카테고리 핀 색 막대. 예정(위시)은 막대를 옅게, 글자를 흐리게. */
function Item({ name, category, wish, onMilestone }: { name: string; category: string | null; wish?: boolean; onMilestone?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 13 }}>
      <View style={{ width: 2.5, height: 11, borderRadius: 1.25, backgroundColor: pinColor(category), opacity: wish ? 0.45 : 1 }} />
      <Text numberOfLines={1} ellipsizeMode="clip" style={{ flex: 1, fontFamily: F.sans, fontSize: 9.5, lineHeight: 13, color: wish ? C.faint : onMilestone ? "#a34d27" : C.ink }}>{name}</Text>
    </View>
  );
}

type MonthProps = {
  year: number; month: number; todayKey: string; startedOn: string | null; showWishes: boolean;
  byDate: Map<string, Restaurant[]>; byDateWish: Map<string, Wish[]>; onOpenDay: (key: string) => void;
};

/** 한 달 — 칸을 나누지 않고 주마다 가는 줄만 긋습니다(애플 캘린더처럼). 오늘은 벽돌 동그라미, 기념일은 옅은 벽돌 동그라미 + 이름. */
const MonthBlock = memo(function MonthBlock({ year, month, todayKey, startedOn, showWishes, byDate, byDateWish, onOpenDay }: MonthProps) {
  const weeks = monthWeeks(year, month);
  const lead = new Date(year, month, 1).getDay();
  const thisMonth = todayKey.startsWith(`${year}-${pad(month + 1)}`);
  return (
    <View style={{ height: MONTH_HEAD + weeks.length * WEEK_H }}>
      <View style={{ height: MONTH_HEAD, flexDirection: "row", alignItems: "flex-end", paddingBottom: 8 }}>
        <View style={{ width: `${(lead / 7) * 100}%` }} />
        <Text style={{ paddingLeft: 4, fontFamily: F.serif, fontSize: 17, color: thisMonth ? C.brick : C.ink }}>{month === 0 ? `${year}년 1월` : `${month + 1}월`}</Text>
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={{ height: WEEK_H, flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }}>
          {week.map((date, di) => {
            if (!date) return <View key={di} style={{ flex: 1 }} />;
            const key = keyOf(date);
            const visits = byDate.get(key) ?? [];
            const wishItems = showWishes ? (byDateWish.get(key) ?? []) : [];
            const isToday = key === todayKey;
            const milestone = startedOn ? milestoneOn(startedOn, key) : null;
            // 줄 높이 안에 들어가는 만큼만 — 넘치면 마지막 줄을 「+N」으로. 기념일 이름이 있으면 한 줄 덜.
            const cap = MAX_ITEMS - (milestone ? 1 : 0);
            const total = visits.length + wishItems.length;
            const room = total > cap ? cap - 1 : total;
            const shownVisits = visits.slice(0, room);
            const shownWishes = wishItems.slice(0, room - shownVisits.length);
            const extra = total - shownVisits.length - shownWishes.length;
            return (
              <Pressable
                key={key}
                onPress={() => onOpenDay(key)}
                accessibilityLabel={`${year}년 ${month + 1}월 ${date.getDate()}일, 기록 ${visits.length}건${wishItems.length ? ` · 예정 ${wishItems.length}건` : ""}${milestone ? ` · ${milestone.label}` : ""}`}
                style={({ pressed }) => ({ flex: 1, minWidth: 0, overflow: "hidden", paddingTop: 4, paddingHorizontal: 2, backgroundColor: pressed ? "#efe9dd" : "transparent" })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 }}>
                  <View style={[s.dateDot, isToday ? { backgroundColor: C.brick } : milestone ? { backgroundColor: C.brickSoft } : null]}>
                    <Text style={{ fontFamily: isToday ? F.sansBd : F.mono, fontSize: 11, color: isToday ? C.card : milestone ? C.brick : C.ink }}>{date.getDate()}</Text>
                  </View>
                </View>
                {milestone && <Text numberOfLines={1} style={{ marginTop: 1, textAlign: "center", fontFamily: F.mono, fontSize: 7.5, color: C.brick }}>{milestone.label}</Text>}
                <View style={{ marginTop: 3, gap: 1.5, overflow: "hidden" }}>
                  {shownVisits.map((v) => <Item key={v.id} name={v.name} category={v.category} onMilestone={!!milestone} />)}
                  {shownWishes.map((w) => <Item key={w.id} name={w.name} category={w.category} wish />)}
                  {extra > 0 && <Text style={{ paddingLeft: 5, fontFamily: F.mono, fontSize: 8.5, color: "#a29a8c" }}>+{extra}</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

/** 월력 — 기록의 visited_at 을 날짜별로 모아 가게 이름(앞에 카테고리 색 막대)으로 보여줍니다. 달은 위아래로 넘깁니다. */
export default function CalendarTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: allRows = [] } = useRows();
  const { data: wishes = [] } = useWishes();
  const rows = useMemo(() => allRows.filter((r) => !r.pending), [allRows]);
  const [showWishes, setShowWishes] = useState(true);
  const [cursorState, setCursorState] = useState<{ year: number; month: number } | null>(null);
  const { data: account } = useAccount();
  const recaps = useRecaps();
  const recapState = useRecapState();
  const [recapList, setRecapList] = useState(false);
  // 연인 기록(HANDOFF-couple §3-10) — 머리 「CALENDAR · 우리」 + D+N, 기념일 배너·칸 강조. 리캡은 개인 기록에만.
  const { book, isCouple } = useActiveBook();
  const { data: picks = [] } = useAnniversaryPicks();
  const startedOn = isCouple ? book?.startedOn ?? null : null;
  const openRecap = (quarter: string) => router.push({ pathname: "/recap/[quarter]", params: { quarter } });

  const maxVisitedAt = useMemo(() => rows.reduce<string | null>((m, r) => (r.visited_at && (!m || r.visited_at > m) ? r.visited_at : m), null), [rows]);
  const cursor = cursorState ?? monthOfKey(maxVisitedAt ?? keyOf(new Date()));

  // 달 목록 — 맨 위에 보이는 달이 머리의 「N년 N월」이 됩니다. 연·월 다이얼에서 고르면 그 달로 바로 넘어갑니다.
  const listRef = useRef<FlatList<{ year: number; month: number }>>(null);
  const moved = useRef(false);
  const jumpTo = (c: { year: number; month: number }) => {
    moved.current = true;
    setCursorState(c);
    listRef.current?.scrollToIndex({ index: monthIndex(c), animated: false });
  };
  // 처음엔 가장 최근 기록의 달 — 기록이 늦게 오면, 아직 손대지 않았을 때만 그 달로 옮깁니다.
  const firstIndex = useRef(monthIndex(cursor)).current;
  useEffect(() => {
    if (moved.current || !maxVisitedAt) return;
    listRef.current?.scrollToIndex({ index: monthIndex(monthOfKey(maxVisitedAt)), animated: false });
  }, [maxVisitedAt]);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken<{ year: number; month: number }>[] }) => {
    const top = viewableItems.find((v) => v.isViewable && v.item);
    if (top?.item && moved.current) setCursorState({ year: top.item.year, month: top.item.month });
  }).current;

  // 연·월 다이얼(§3) — 누른 글자 바로 아래에 펼칩니다. 위치는 글자를 창 기준으로 재서 맞춥니다.
  const yearRef = useRef<View>(null);
  const monthRef = useRef<View>(null);
  const [picker, setPicker] = useState<null | { kind: "year" | "month"; x: number; y: number }>(null);
  const openPicker = (kind: "year" | "month") =>
    (kind === "year" ? yearRef : monthRef).current?.measureInWindow((x, y, _w, h) => setPicker({ kind, x, y: y + h + 2 }));

  const byDate = useMemo(() => groupBy<Restaurant>(rows, (r) => r.visited_at), [rows]);
  const byDateWish = useMemo(() => groupBy<Wish>(wishes, (w) => w.plan_date), [wishes]);
  const openDay = useCallback((key: string) => router.push({ pathname: "/day/[date]", params: { date: key } }), [router]);

  const prefix = `${cursor.year}-${pad(cursor.month + 1)}`;
  const countThisMonth = rows.filter((r) => r.visited_at?.startsWith(prefix)).length;
  const todayKey = keyOf(new Date());

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 22 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow wide>{isCouple ? "CALENDAR · 우리" : "CALENDAR"}</Eyebrow>
          {startedOn && <Text style={{ fontFamily: F.mono, fontSize: 11.5, color: C.brick }}>D+{dayCount(startedOn)}</Text>}
        </View>
        <View style={s.titleRow}>
          <Pressable ref={yearRef} onPress={() => openPicker("year")} hitSlop={8} accessibilityHint="연도를 고르는 다이얼이 열립니다">
            <Text style={s.title}>{cursor.year}년</Text>
          </Pressable>
          <Pressable ref={monthRef} onPress={() => openPicker("month")} hitSlop={8} accessibilityHint="월을 고르는 다이얼이 열립니다">
            <Text style={s.title}>{cursor.month + 1}월</Text>
          </Pressable>
        </View>
        <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.faint }}>이 달 기록 {countThisMonth}건</Text>
          <Pressable
            onPress={() => setShowWishes((v) => !v)}
            style={[s.toggle, showWishes && { borderWidth: 1, borderColor: "#e0c3b1", backgroundColor: C.brickSoft }]}
          >
            {showWishes && <View style={{ width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: C.brick }} />}
            <Text style={{ fontFamily: F.sans, fontSize: 11, color: showWishes ? C.brick : C.faint }}>{showWishes ? "예정 보임" : "예정 숨김"}</Text>
          </Pressable>
        </View>
      </View>

      {/* 연인 기록이면 리캡 자리에 기념일 배너(HANDOFF-recommend §3-2). */}
      {startedOn && <AnniversaryBanner startedOn={startedOn} picks={picks} rows={rows} />}

      {!isCouple && recaps.latest && (
        <RecapCard
          summary={recaps.latest}
          nick={account?.nickname?.trim() || "나"}
          unseen={recapState.loaded && !recapState.seen(recaps.latest.quarter)}
          onOpen={() => openRecap(recaps.latest!.quarter)}
          onList={() => setRecapList(true)}
        />
      )}

      <View style={{ marginTop: 14, flexDirection: "row", paddingHorizontal: 12 }}>
        {WEEKDAYS.map((w) => <Text key={w} style={s.weekday}>{w}</Text>)}
      </View>

      {/* 탭바는 화면 아래에 따로 놓여서(절대 위치 아님) 이 화면은 이미 탭바 위에서 끝납니다. iOS 는 떠 있는 탭바 만큼 끝에 여유를 둡니다. */}
      <FlatList
        ref={listRef}
        data={ALL_MONTHS}
        keyExtractor={(m) => `${m.year}-${m.month}`}
        renderItem={({ item }) => (
          <MonthBlock year={item.year} month={item.month} todayKey={todayKey} startedOn={startedOn} showWishes={showWishes} byDate={byDate} byDateWish={byDateWish} onOpenDay={openDay} />
        )}
        getItemLayout={(_, index) => ({ ...MONTH_LAYOUT[index], index })}
        initialScrollIndex={firstIndex}
        initialNumToRender={2}
        windowSize={5}
        onScrollBeginDrag={() => { moved.current = true; }}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Platform.OS === "android" ? 30 : 74 + insets.bottom + 12 }}
      />

      <Modal visible={!!picker} transparent animationType="none" onRequestClose={() => setPicker(null)} statusBarTranslucent>
        <Pressable onPress={() => setPicker(null)} style={{ flex: 1 }}>
          {picker && (
            <Pressable onPress={() => {}} style={[s.popover, { left: picker.x, top: picker.y, width: picker.kind === "year" ? 104 : 84 }]}>
              {picker.kind === "year" ? (
                <Dial
                  labels={YEARS.map((y) => `${y}년`)}
                  index={Math.max(0, YEARS.indexOf(cursor.year))}
                  onPick={(i) => { jumpTo({ year: YEARS[i], month: cursor.month }); setPicker(null); }}
                />
              ) : (
                <Dial
                  labels={MONTHS.map((m) => `${m + 1}월`)}
                  index={cursor.month}
                  onPick={(i) => { jumpTo({ year: cursor.year, month: i }); setPicker(null); }}
                />
              )}
            </Pressable>
          )}
        </Pressable>
      </Modal>

      <RecapListSheet
        visible={recapList}
        list={recaps.list}
        seen={recapState.seen}
        onClose={() => setRecapList(false)}
        onPick={(q) => { setRecapList(false); openRecap(q); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  titleRow: { marginTop: 8, flexDirection: "row", alignItems: "baseline", gap: 6 },
  title: { fontFamily: F.serif, fontSize: 22, color: C.ink },
  popover: {
    position: "absolute", borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    ...Platform.select({ ios: { shadowColor: C.ink, shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 12 } }, default: { elevation: 8 } }),
  },
  toggle: { minHeight: 30, borderRadius: 15, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6 },
  weekday: { flex: 1, textAlign: "center", fontFamily: F.mono, fontSize: 10, color: C.faint },
  dateDot: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 3, alignItems: "center", justifyContent: "center" },
});
