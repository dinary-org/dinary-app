import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/Text";
import { REC_CATEGORIES, type RecCategory } from "@/lib/recommend";
import type { Scored } from "@/lib/rec/score";
import { C, F } from "@/theme";
import { FrenchFries } from "./FrenchFries";
import { MarbleRace } from "./MarbleRace";
import { PLAYERS0 } from "./party";
import { PizzaDough } from "./PizzaDough";
import { TugOfWar } from "./TugOfWar";
import { REC, SectionHead } from "./ui";
import { WinPopup } from "./WinPopup";

/** 칸 수 · 적어 넣는 글자 수 · 직접 선택을 기기에 남겨 두는 키. */
const CUSTOM_MAX = 12;
const CUSTOM_LEN = 12;
// 키 이름은 옛 룰렛 시절 그대로 — 바꾸면 기기에 남겨 둔 직접 선택 칸을 잃습니다.
const CUSTOM_KEY = "rec.roulette.custom";

type Tab = "place" | "category" | "custom";
type Option = { key: string; label: string };

type Mode = "fries" | "pizza" | "marble" | "tug";
const MODES: { id: Mode; label: string }[] = [
  { id: "fries", label: "감자튀김" },
  { id: "pizza", label: "피자" },
  { id: "marble", label: "구슬 경주" },
  { id: "tug", label: "줄다리기" },
];

const TABS: { id: Tab; label: string }[] = [
  { id: "place", label: "추천된 가게" },
  { id: "category", label: "카테고리" },
  { id: "custom", label: "직접 선택" },
];

/** 「면으로」 · 「한식으로」 — 받침(ㄹ 빼고) 있으면 「으로」. */
const euro = (w: string) => {
  const code = w.charCodeAt(w.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "로";
  const jong = code % 28;
  return jong === 0 || jong === 8 ? "로" : "으로";
};

/**
 * 「랜덤 게임」 모드 — 목표 시간에 가장 가깝게 건지는 감자튀김(FrenchFries.tsx) · 모양대로 도우를 펴는 피자(PizzaDough.tsx) — 둘은 칸 없이 사람끼리 겨루고 참가자 목록을 같이 씁니다, 먼저 들어오면 이기는 구슬 경주(MarbleRace.tsx), 둘이 겨루는 줄다리기(TugOfWar.tsx). 추천된 가게 · 카테고리 · 직접 선택 셋 중에서 고르고,
 * 칸 옆 − 로 빼고, + 로 원하는 가게 · 카테고리 · 메뉴를 적어 넣습니다. 카테고리가 나오면 그 종류로 다시 추천받을 수 있습니다. 직접 입력한 것은 기기에 남깁니다.
 */
export function RandomGames({ picks, exclude, onPlace, onCategory, onDrawTouch }: {
  picks: Scored[]; exclude: readonly string[];
  onPlace: (i: number) => void; onCategory: (cat: RecCategory) => void;
  /** 피자 판을 만지는 동안 true — 화면 스크롤을 멈춥니다. */
  onDrawTouch?: (touching: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>("fries");
  const [names, setNames] = useState(PLAYERS0);
  const [tab, setTab] = useState<Tab>(picks.length >= 2 ? "place" : "category");
  // 추천이 늦게 들어오면(이 화면을 먼저 연 경우) 손대기 전까지는 추천된 가게로 옮깁니다.
  const tabTouched = useRef(false);
  useEffect(() => { if (!tabTouched.current && picks.length >= 2) setTab("place"); }, [picks.length]);
  // 탭마다 뺀 칸(removed: 기본 칸의 key)과 더한 칸(added: 적어 넣은 이름). 직접 선택은 더한 칸만 있고 기기에 남깁니다.
  const [removed, setRemoved] = useState<Record<Tab, string[]>>({ place: [], category: [], custom: [] });
  const [added, setAdded] = useState<Record<Tab, string[]>>({ place: [], category: [], custom: [] });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_KEY).then((v) => {
      const list = v ? (JSON.parse(v) as unknown) : null;
      if (Array.isArray(list)) setAdded((cur) => ({ ...cur, custom: list.filter((x): x is string => typeof x === "string").slice(0, CUSTOM_MAX) }));
    }).catch(() => {});
  }, []);
  const setAddedFor = (t: Tab, next: string[]) => {
    setAdded((cur) => ({ ...cur, [t]: next }));
    if (t === "custom") AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(next)).catch(() => {});
  };
  useEffect(() => { setAdding(false); setDraft(""); }, [tab]);

  // 기본 칸 — 추천된 가게 / 카테고리(필터에서 뺀 종류 빼고). 직접 선택은 없음.
  const base: Option[] = useMemo(() => {
    if (tab === "place") return picks.map((p) => ({ key: p.c.key, label: p.c.name }));
    if (tab === "category") return REC_CATEGORIES.filter((c) => !exclude.includes(c)).map((c) => ({ key: c, label: c }));
    return [];
  }, [tab, picks, exclude]);
  const live: Option[] = [
    ...base.filter((o) => !removed[tab].includes(o.key)),
    ...added[tab].map((l) => ({ key: `+${l}`, label: l })),
  ];
  /** 뺐던 기본 칸 — 「+」를 누르면 다시 넣을 수 있게 보여 줍니다. */
  const restorable = base.filter((o) => removed[tab].includes(o.key));

  function removeOption(o: Option) {
    Haptics.selectionAsync();
    if (o.key.startsWith("+")) setAddedFor(tab, added[tab].filter((l) => `+${l}` !== o.key));
    else setRemoved((cur) => ({ ...cur, [tab]: [...cur[tab], o.key] }));
  }
  function restore(o: Option) {
    Haptics.selectionAsync();
    setRemoved((cur) => ({ ...cur, [tab]: cur[tab].filter((k) => k !== o.key) }));
  }
  function addDraft() {
    const v = draft.trim().slice(0, CUSTOM_LEN);
    if (!v) return;
    setDraft("");
    // 뺐던 기본 칸과 이름이 같으면 그걸 되살립니다.
    const back = restorable.find((o) => o.label === v);
    if (back) return restore(back);
    if (live.some((o) => o.label === v) || live.length >= CUSTOM_MAX) return;
    Haptics.selectionAsync();
    setAddedFor(tab, [...added[tab], v]);
  }

  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<Option | null>(null);
  // 칸이 바뀌면(탭 · 빼고 넣기 · 다시 추천) 결과를 지웁니다.
  const sig = `${tab}|${live.map((o) => o.key).join("|")}`;
  useEffect(() => { setWon(null); }, [sig]);
  // 결과가 나오면 화면 한가운데 큰 창으로 — 구슬 경주는 1등이 결승선을 지나는 걸 잠깐 보여 준 뒤에.
  const [popup, setPopup] = useState<Option | null>(null);
  useEffect(() => {
    if (!won) return setPopup(null);
    const id = setTimeout(() => setPopup(won), mode === "marble" ? 700 : 250);
    return () => clearTimeout(id);
  }, [won, mode]);

  const ready = live.length >= 2;
  /** 나온 칸이 추천된 가게 · 카테고리면 그리로 가는 단추. */
  const wonAction = won && ((tab === "place" && !won.key.startsWith("+")) || (tab === "category" && (REC_CATEGORIES as readonly string[]).includes(won.label))) ? {
    text: tab === "place" ? "카드에서 보기" : `${won.label}${euro(won.label)} 추천받기`,
    onPress: () => {
      Haptics.selectionAsync();
      setPopup(null);
      if (tab === "place") onPlace(picks.findIndex((p) => p.c.key === won.key));
      else onCategory(won.key as RecCategory);
    },
  } : null;
  const empty =
    tab === "custom" && live.length === 0 ? "+ 를 눌러 메뉴나 가게를 넣어 보세요"
    : live.length < 2 ? "두 칸 넘게 있어야 할 수 있어요"
    : null;

  return (
    <View>
      <View>
        <SectionHead title="결정을 하지 못하시겠다면?" />
        {/* 감자튀김 · 피자 · 구슬 경주 · 줄다리기 */}
        <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {MODES.map((m) => {
            const on = mode === m.id;
            return (
              <Pressable
                key={m.id}
                disabled={spinning}
                onPress={() => { if (!on) { Haptics.selectionAsync(); setMode(m.id); setWon(null); } }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ height: 30, borderRadius: 15, paddingHorizontal: 13, justifyContent: "center", borderWidth: 1, borderColor: on ? C.brick : C.lineSoft, backgroundColor: on ? C.brickSoft : "transparent" }}
              >
                <Text style={{ fontFamily: on ? F.sansMd : F.sans, fontSize: 11.5, color: on ? C.brick : C.muted }}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ marginTop: 12, borderRadius: 24, borderWidth: 1, borderColor: C.lineSoft, backgroundColor: REC.paper, padding: 16 }}>
        {mode === "fries" ? <FrenchFries names={names} setNames={setNames} />
        : mode === "pizza" ? <PizzaDough names={names} setNames={setNames} onTouch={onDrawTouch} /> : (
        <>
        {/* 고를 거리 — 세 칸 전환 */}
        <View style={{ height: 38, borderRadius: 19, backgroundColor: "#efebe2", padding: 3, flexDirection: "row", gap: 3 }}>
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <Pressable
                key={t.id}
                disabled={spinning}
                onPress={() => { if (!on) { Haptics.selectionAsync(); tabTouched.current = true; setTab(t.id); } }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ flex: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: on ? C.ink : "transparent" }}
              >
                <Text style={{ fontFamily: on ? F.sansMd : F.sans, fontSize: 12.5, color: on ? C.card : C.muted }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 칸 — 옆의 − 로 빼고, 끝의 + 로 더합니다(적어 넣거나 뺐던 칸 되살리기). */}
        <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {live.map((o) => (
            <View key={o.key} style={{ height: 32, borderRadius: 16, paddingLeft: 12, paddingRight: 4, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
              <Text numberOfLines={1} style={{ maxWidth: 140, fontFamily: F.sansMd, fontSize: 12, color: C.ink }}>{o.label}</Text>
              <Pressable onPress={() => removeOption(o)} disabled={spinning} hitSlop={6} accessibilityLabel={`${o.label} 빼기`} style={s.minus}>
                <Text style={{ fontFamily: F.sansMd, fontSize: 13, lineHeight: 15, color: C.muted }}>−</Text>
              </Pressable>
            </View>
          ))}
          {!adding && live.length < CUSTOM_MAX && (
            <Pressable onPress={() => { Haptics.selectionAsync(); setAdding(true); }} disabled={spinning} accessibilityLabel="칸 더하기" style={s.plus}>
              <Text style={{ fontFamily: F.sansMd, fontSize: 16, lineHeight: 18, color: C.brick }}>+</Text>
            </Pressable>
          )}
        </View>
        {adding && (
          <View style={{ marginTop: 10 }}>
            <View style={{ height: 42, borderRadius: 14, borderWidth: 1.5, borderColor: C.brick, backgroundColor: C.card, paddingLeft: 14, paddingRight: 5, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <TextInput
                autoFocus
                value={draft}
                onChangeText={(t) => setDraft(t.slice(0, CUSTOM_LEN))}
                onSubmitEditing={addDraft}
                maxLength={CUSTOM_LEN}
                placeholder={tab === "place" ? "가게 이름" : tab === "category" ? "예: 샐러드" : "예: 김치찌개"}
                placeholderTextColor="#b3ada1"
                returnKeyType="done"
                style={{ flex: 1, height: "100%", fontFamily: F.sans, fontSize: 13, color: C.ink }}
              />
              <Pressable onPress={addDraft} disabled={!draft.trim()} style={{ height: 32, borderRadius: 11, paddingHorizontal: 12, justifyContent: "center", backgroundColor: draft.trim() ? C.ink : "#d8d3c8" }}>
                <Text style={{ fontFamily: F.sansMd, fontSize: 12, color: C.card }}>추가</Text>
              </Pressable>
              <Pressable onPress={() => { setAdding(false); setDraft(""); }} hitSlop={6} accessibilityLabel="닫기" style={{ width: 30, height: 32, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 12, color: "#a29a8c" }}>✕</Text>
              </Pressable>
            </View>
            {restorable.length > 0 && (
              <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {restorable.map((o) => (
                  <Pressable key={o.key} onPress={() => restore(o)} accessibilityLabel={`${o.label} 다시 넣기`} style={{ height: 30, borderRadius: 15, paddingHorizontal: 11, justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: "#cdc6b8" }}>
                    <Text numberOfLines={1} style={{ maxWidth: 140, fontFamily: F.sans, fontSize: 12, color: C.muted }}>+ {o.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {mode === "tug" ? (
          <View style={{ marginTop: 22 }}>
            <TugOfWar
              options={live}
              busy={spinning}
              onStart={() => { setWon(null); setSpinning(true); }}
              onDone={(o) => { setSpinning(false); setWon(o); }}
            />
          </View>
        ) : (
          <View style={{ marginTop: 22 }}>
            <MarbleRace
              options={live}
              busy={spinning}
              onStart={() => { setWon(null); setSpinning(true); }}
              onDone={(o) => { setSpinning(false); setWon(o); }}
            />
          </View>
        )}

        {/* 결과 */}
        <View style={{ marginTop: 18, minHeight: 70, alignItems: "center", justifyContent: "center" }}>
          {empty ? (
            <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: C.faint }}>{empty}</Text>
          ) : won ? (
            <View style={{ alignItems: "center", gap: 10 }}>
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, color: C.brick }}>오늘은 이걸로</Text>
                <Text style={{ fontFamily: F.sansBd, fontSize: 24, color: C.ink, textAlign: "center" }}>{won.label}</Text>
              </View>
              {wonAction && (
                <Pressable
                  onPress={wonAction.onPress}
                  accessibilityRole="button"
                  style={{ height: 36, borderRadius: 18, backgroundColor: C.brick, paddingHorizontal: 16, justifyContent: "center" }}
                >
                  <Text style={{ fontFamily: F.sansMd, fontSize: 12.5, color: C.card }}>{wonAction.text}</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.faint }}>{mode === "marble" ? "먼저 들어온 구슬이 이겨요" : "둘이 하나씩 고르고, 내 칸을 빨리 두드려 끌어오세요"}</Text>
          )}
        </View>
        </>
        )}
      </View>
      <WinPopup label={popup?.label ?? null} action={wonAction} onClose={() => setPopup(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  minus: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#efebe2", alignItems: "center", justifyContent: "center" },
  plus: { width: 44, height: 32, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: C.brick, alignItems: "center", justifyContent: "center" },
});
