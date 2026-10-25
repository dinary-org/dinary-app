import * as Haptics from "expo-haptics";
import type { Dispatch, SetStateAction } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Text } from "@/components/Text";
import { C, F } from "@/theme";

/**
 * 휴대폰 한 대를 돌려 가며 하는 게임(감자튀김 · 피자)이 같이 쓰는 조각 — 참가자 목록 · 멘트 고르기 · 최근 줄 바탕색.
 */
export const PLAYERS0 = ["태현", "예준"];
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
const NAME_LEN = 8;
/** 기록 · 순위에서 가장 최근 줄 · 1등 바탕. */
export const HI = "#f2ddcf";

export const pad2 = (n: number) => String(n).padStart(2, "0");
/** 이름을 비워 두면 「참가자 N」. */
export const playerNames = (names: string[]) => names.map((n, i) => n.trim() || `참가자 ${i + 1}`);

/** 같은 판에서 나온 멘트는 빼고 고릅니다 — 그 묶음을 다 썼을 때만 다시. */
export function pickFresh(group: string[], used: Set<string>) {
  const fresh = group.filter((m) => !used.has(m));
  const pool = fresh.length ? fresh : group;
  const m = pool[Math.floor(Math.random() * pool.length)];
  used.add(m);
  return m;
}

/** 참가자 — 이름은 바로 고치고, − 로 빼고(2명까지), + 로 더합니다(8명까지). */
export function Players({ names, setNames }: { names: string[]; setNames: Dispatch<SetStateAction<string[]>> }) {
  const players = playerNames(names);
  return (
    <>
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
    </>
  );
}
