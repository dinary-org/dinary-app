import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Text } from "@/components/Text";
import { SearchIcon } from "@/components/icons";
import { SearchResults } from "@/components/ui";
import type { Place } from "@/lib/geocode";
import { useBlurOnKeyboardHide } from "@/lib/keyboard";
import { usePlaceSearch } from "@/lib/usePlaceSearch";
import { C, F, SHADOW } from "@/theme";

/** 지도 위 메인 검색창 — 어디든 실시간으로(가까운 곳부터) 찾아 지도를 옮깁니다. 키보드가 내려가면 목록도 닫힙니다. */
export default function PlaceSearch({
  value, onChange, onChoose, hasPicked, onClearPicked, placeholder = "음식점이나 지역 찾기",
}: {
  value: string; onChange: (v: string) => void; onChoose: (p: Place) => void; hasPicked: boolean; onClearPicked: () => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const { results, busy, loadMore, clear } = usePlaceSearch(value, open);
  const input = useRef<TextInput>(null);
  useBlurOnKeyboardHide(input);

  return (
    <View style={{ flex: 1 }}>
      <View style={[{ height: 46, borderRadius: 23, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 9 }, SHADOW.card]}>
        <SearchIcon />
        <TextInput
          ref={input}
          value={value}
          onChangeText={(t) => { onChange(t); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          placeholderTextColor="#b3ada1"
          returnKeyType="search"
          style={{ flex: 1, fontFamily: F.sans, fontSize: 13.5, color: C.ink, padding: 0 }}
        />
        {busy && <ActivityIndicator size="small" color={C.faint} />}
        {(!!value || hasPicked) && !busy && (
          <Pressable onPress={() => { onChange(""); clear(); onClearPicked(); }} hitSlop={8}>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.faint }}>지우기</Text>
          </Pressable>
        )}
      </View>

      {/* 목록은 absolute 로 띄우지 않고 이 View 안에 쌓습니다. 부모 상자 밖으로 삐져나오면 RN 은 항목 탭을 받지만
          네이티브 지도도 같은 탭을 받아, 그 자리의 기록 마커가 함께 눌려 기록 화면이 열려버립니다. */}
      {open && results.length > 0 && (
        <SearchResults
          items={results}
          keyOf={(p, i) => `${p.lat}-${p.lng}-${i}`}
          title={(p) => p.name || p.address}
          sub={(p) => p.address}
          onPick={(p) => { input.current?.blur(); onChange(p.name || p.address); setOpen(false); clear(); onChoose(p); }}
          onEndReached={loadMore}
          style={{ borderRadius: 16 }}
        />
      )}
    </View>
  );
}
