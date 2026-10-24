import type { NaverMapViewRef } from "@mj-studio/react-native-naver-map";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Text } from "@/components/Text";
import { PaperMap } from "@/components/PaperMap";
import { LocateIcon, SearchIcon } from "@/components/icons";
import { BottomSheetModal, SearchResults } from "@/components/ui";
import type { RecHere } from "@/data/store";
import { reverseGeocode, type Place } from "@/lib/geocode";
import { useBlurOnKeyboardHide } from "@/lib/keyboard";
import { areaOf } from "@/lib/recommend";
import { usePlaceSearch } from "@/lib/usePlaceSearch";
import { C, F, SHADOW } from "@/theme";
import { HereMarker } from "./ui";

const MAP_H = 190;
const ZOOM = 15;
/** 가운데 핀 — 점 16px + 흰 테두리, 아래로 짧은 꼬리. 꼬리 끝이 지도 가운데입니다. */
const PIN_D = 18;
const PIN_TAIL = 9;

/**
 * 추천 기준 자리 고르기 — 머리의 「성수동2가 · 토 15:02」를 누르면 열립니다.
 * 동네 · 역 검색 또는 아래 작은 지도를 끌어 가운데 핀으로 고릅니다. 「지금 위치로」는 지금 위치로 되돌립니다.
 * place 가 null 이면 지금 위치입니다. 시각은 「지금 뭐 먹지」의 점심 · 저녁으로 바꿉니다.
 */
export function PointSheet({
  visible, gps, place, onClose, onApply,
}: {
  visible: boolean; gps: RecHere | null; place: RecHere | null;
  onClose: () => void; onApply: (place: RecHere | null) => void;
}) {
  const [draftPlace, setDraftPlace] = useState<RecHere | null>(place);
  const [q, setQ] = useState("");
  // 동네 · 역 이름 검색 — 250ms 쉬면 가까운 곳부터 찾고, 끝까지 내리면 더. 키보드가 내려가면 목록도 닫습니다.
  const [focused, setFocused] = useState(false);
  const { results: hits, busy: searching, loadMore, clear } = usePlaceSearch(q);
  const input = useRef<TextInput>(null);
  useBlurOnKeyboardHide(input);

  // 지도 — 손으로 끌어 멈춘 자리만 고릅니다(검색 · 되돌리기로 옮긴 카메라는 고르지 않음). 이름은 좌표 → 동네로.
  const map = useRef<NaverMapViewRef>(null);
  const dragged = useRef(false);
  const naming = useRef<AbortController | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraftPlace(place); setQ(""); clear();
  }, [visible, place, clear]);
  useEffect(() => () => naming.current?.abort(), []);

  const point = draftPlace ?? gps;
  const moveTo = (p: RecHere | null) => {
    if (p) map.current?.animateCameraTo({ latitude: p.lat, longitude: p.lng, zoom: ZOOM, duration: 300 });
  };
  const choose = (p: RecHere | null) => {
    naming.current?.abort();
    setLocating(false);
    setDraftPlace(p);
    moveTo(p ?? gps);
  };
  const pickAt = (lat: number, lng: number) => {
    naming.current?.abort();
    const ctrl = new AbortController();
    naming.current = ctrl;
    setDraftPlace({ lat, lng, name: null, fallback: false });
    setLocating(true);
    void reverseGeocode(lat, lng, ctrl.signal).then((p) => {
      if (ctrl.signal.aborted) return;
      setLocating(false);
      const name = p ? areaOf(p.address, p.region) ?? p.address : null;
      setDraftPlace((d) => (d && d.lat === lat && d.lng === lng ? { ...d, name } : d));
    });
  };
  const nameOf = (p: Place) => p.name || areaOf(p.address, p.region) || p.address;

  const title = draftPlace ? (locating ? "위치를 찾는 중" : draftPlace.name ?? "지도에서 고른 곳") : gps?.name ?? "위치를 찾는 중";
  const sub = draftPlace ? "고른 곳" : gps?.fallback ? "자주 기록한 동네" : "지금 있는 곳";
  const searchOpen = focused && hits.length > 0;

  return (
    <BottomSheetModal visible={visible} onClose={onClose} dim={0.38}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: F.serif, fontSize: 20, color: C.ink }}>어디서 드세요?</Text>
        {draftPlace && gps && (
          <Pressable onPress={() => choose(null)} hitSlop={10} accessibilityRole="button">
            <Text style={{ fontFamily: F.sansMd, fontSize: 12.5, color: C.brick }}>지금 위치로</Text>
          </Pressable>
        )}
      </View>

      <View style={{ marginTop: 14, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <SearchIcon />
        <TextInput
          ref={input}
          value={q}
          onChangeText={setQ}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          returnKeyType="search"
          placeholder="동네 · 역 이름으로 찾기"
          placeholderTextColor={C.faint}
          style={{ flex: 1, fontFamily: F.sans, fontSize: 13, color: C.ink, paddingVertical: 8 }}
        />
        {searching && <ActivityIndicator size="small" color={C.faint} />}
      </View>
      {searchOpen && (
        <SearchResults
          items={hits}
          keyOf={(p, i) => `${p.lat},${p.lng},${i}`}
          title={nameOf}
          sub={(p) => (p.address && p.address !== nameOf(p) ? p.address : null)}
          onPick={(p) => { input.current?.blur(); choose({ lat: p.lat, lng: p.lng, name: nameOf(p), fallback: false }); setQ(""); clear(); }}
          onEndReached={loadMore}
          maxHeight={220}
        />
      )}

      {/* 지도 — 검색 목록이 열려 있는 동안은 접어 둡니다(키보드 위 자리가 좁아서). */}
      <View style={{ display: searchOpen ? "none" : "flex" }}>
        <View style={{ marginTop: 12, height: MAP_H, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: C.lineSoft, backgroundColor: C.card }}>
          {point ? (
            <>
              <PaperMap
                ref={map}
                initialCamera={{ latitude: (place ?? point).lat, longitude: (place ?? point).lng, zoom: ZOOM }}
                isRotateGesturesEnabled={false}
                isTiltGesturesEnabled={false}
                isShowIndoorLevelPicker={false}
                onCameraChanged={({ reason }) => { if (reason === "Gesture") dragged.current = true; }}
                onCameraIdle={({ latitude, longitude }) => {
                  if (!dragged.current) return;
                  dragged.current = false;
                  pickAt(latitude, longitude);
                }}
              >
                {gps && !gps.fallback && <HereMarker lat={gps.lat} lng={gps.lng} />}
              </PaperMap>
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: MAP_H / 2 - PIN_D - PIN_TAIL, alignItems: "center" }}>
                <View style={[{ width: PIN_D, height: PIN_D, borderRadius: PIN_D / 2, borderWidth: 3, borderColor: "#ffffff", backgroundColor: C.brick }, SHADOW.card]} />
                <View style={{ width: 2, height: PIN_TAIL, borderRadius: 1, backgroundColor: C.brick }} />
              </View>
              {gps && (
                <Pressable
                  onPress={() => choose(null)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="지금 위치로"
                  style={[{ position: "absolute", right: 10, bottom: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }, SHADOW.card]}
                >
                  <LocateIcon size={18} />
                </Pressable>
              )}
            </>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={C.faint} />
            </View>
          )}
        </View>
        <Text style={{ marginTop: 6, fontFamily: F.sans, fontSize: 11, color: C.faint, textAlign: "center" }}>지도를 끌어 핀을 옮겨도 돼요</Text>
      </View>

      <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: F.sansMd, fontSize: 14, color: C.ink }}>{title}</Text>
          <Text style={{ marginTop: 1, fontFamily: F.sans, fontSize: 11, color: C.faint }}>{sub}</Text>
        </View>
        <Pressable
          onPress={() => onApply(draftPlace)}
          disabled={!point || locating}
          style={{ height: 48, paddingHorizontal: 20, borderRadius: 16, backgroundColor: C.brick, alignItems: "center", justifyContent: "center", opacity: !point || locating ? 0.5 : 1 }}
        >
          <Text style={{ fontFamily: F.sansMd, fontSize: 14, color: C.card }}>여기서 추천 받기</Text>
        </Pressable>
      </View>
    </BottomSheetModal>
  );
}
