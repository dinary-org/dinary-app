import { NaverMapPolylineOverlay } from "@mj-studio/react-native-naver-map";
import { useMemo } from "react";
import { View } from "react-native";
import { PaperMap } from "@/components/PaperMap";
import { NumberMarker } from "@/features/recommend/ui";
import { C } from "@/theme";

export type CourseMapStop = { lat: number | null; lng: number | null; name: string };

/** 가게들이 한 화면에 다 들어오는 영역 — 위쪽은 이름 말풍선 자리만큼 더 둡니다. */
function fit(pts: { lat: number; lng: number }[]) {
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const padLat = Math.max(0.0015, (maxLat - minLat) * 0.3);
  const padLng = Math.max(0.0015, (maxLng - minLng) * 0.3);
  return {
    latitude: minLat - padLat, longitude: minLng - padLng,
    latitudeDelta: maxLat - minLat + padLat * 2.6, longitudeDelta: maxLng - minLng + padLng * 2,
  };
}

/**
 * 코스 지도 — 네이버 지도 위에 번호 핀 + 가게 이름, 순서대로 점선. 가게가 모두 들어오게 맞춥니다.
 * onTouch 로 바깥 세로 스크롤을 멈춰 지도 끌기 · 확대가 먹히게 합니다. 좌표 있는 가게가 없으면 그리지 않습니다.
 * interactive={false}(목록 카드)면 지도를 만지지 못하게 — 손가락은 카드로 넘어가 목록 스크롤 · 글 열기가 그대로 됩니다.
 */
export function CourseMap({ stops, height = 200, onTouch, interactive = true }: { stops: CourseMapStop[]; height?: number; onTouch?: (touching: boolean) => void; interactive?: boolean }) {
  const pts = stops.flatMap((s, i) => (s.lat != null && s.lng != null ? [{ lat: s.lat, lng: s.lng, name: s.name, n: i + 1 }] : []));
  // 메모를 칠 때마다 카메라가 다시 움직이지 않게 — 좌표가 바뀔 때만 다시 맞춥니다.
  const key = pts.map((p) => `${p.lat},${p.lng}`).join("|");
  const region = useMemo(() => (pts.length ? fit(pts) : undefined), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pts.length) return null;
  return (
    <View
      pointerEvents={interactive ? "auto" : "none"}
      style={{ height, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.lineSoft, backgroundColor: C.map }}
      onTouchStart={() => onTouch?.(true)}
      onTouchEnd={() => onTouch?.(false)}
      onTouchCancel={() => onTouch?.(false)}
    >
      <PaperMap
        region={region}
        isRotateGesturesEnabled={false}
        isTiltGesturesEnabled={false}
        isScrollGesturesEnabled={interactive}
        isZoomGesturesEnabled={interactive}
        isStopGesturesEnabled={interactive}
        isShowIndoorLevelPicker={false}
      >
        {pts.length > 1 && (
          <NaverMapPolylineOverlay coords={pts.map((p) => ({ latitude: p.lat, longitude: p.lng }))} width={2.5} color={C.brick} pattern={[8, 6]} />
        )}
        {pts.map((p) => (
          <NumberMarker key={`${p.n}-${p.lat},${p.lng}`} lat={p.lat} lng={p.lng} n={p.n} name={p.name} active={false} label />
        ))}
      </PaperMap>
    </View>
  );
}
