/**
 * 주소 · 좌표 · 가게 검색 — 카카오 키를 쓰는 Edge Function geocode 를 부릅니다.
 */
import * as Location from "expo-location";
import { apiFetch } from "./api";

export type Place = {
  name: string;
  address: string;
  region: string | null;
  lat: number;
  lng: number;
};

export type NearbyPlace = Place & {
  /** 읽은 좌표에서의 거리(m) */
  distance: number;
  category: string | null;
  kind: "restaurant" | "cafe";
  /** 카카오 장소 페이지 — 「카카오맵에서 보기」. 배포 전 서버면 없습니다. */
  place_url?: string | null;
};

export type FoodPlace = Place & {
  /** 검색 기준 자리에서의 거리(m). 자리를 모르면 0 */
  distance?: number;
  category: string | null;
  kind: "restaurant" | "cafe";
  place_url?: string | null;
};

type Spot = { lat: number; lng: number };

let spot: { at: number; value: Spot | null } | null = null;

/**
 * 검색을 가까운 순으로 매길 자리 — 이미 받은 위치 권한으로 마지막 위치만 읽습니다(묻지 않음).
 * 2분 동안 기억해 두어 글자마다 위치를 다시 읽지 않습니다. 모르면 null(관련도 순).
 */
async function searchSpot(): Promise<Spot | null> {
  if (spot && Date.now() - spot.at < 120_000) return spot.value;
  const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
  const pos = perm?.granted ? await Location.getLastKnownPositionAsync().catch(() => null) : null;
  const value = pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
  spot = { at: Date.now(), value };
  return value;
}

const fromParam = (p: Spot | null): Record<string, string> => (p ? { from: `${p.lat},${p.lng}` } : {});

async function ask(params: Record<string, string>, signal?: AbortSignal) {
  const res = await apiFetch(`/geocode?${new URLSearchParams(params)}`, { signal });
  if (!res.ok) throw new Error("주소 검색에 실패했습니다");
  const json = (await res.json()) as { places?: Place[] };
  return json.places ?? [];
}

/** 주소·상호 → 좌표. 가까운 곳이 앞입니다. */
export async function forwardGeocode(query: string, signal?: AbortSignal) {
  return (await searchPlaces(query, 1, signal)).places;
}

/** 주소·상호 검색 한 쪽(15곳 + 첫 쪽엔 주소). more 면 다음 쪽이 있습니다 — 목록 끝까지 내리면 부릅니다. */
export async function searchPlaces(query: string, page: number, signal?: AbortSignal): Promise<{ places: Place[]; more: boolean }> {
  const q = query.trim();
  if (q.length < 2) return { places: [], more: false };
  const near = await searchSpot();
  const res = await apiFetch(`/geocode?${new URLSearchParams({ q, page: String(page), ...fromParam(near) })}`, { signal });
  if (!res.ok) throw new Error("주소 검색에 실패했습니다");
  const json = (await res.json()) as { places?: Place[]; more?: boolean };
  return { places: json.places ?? [], more: !!json.more };
}

/** 좌표 → 주소 */
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<Place | null> {
  const places = await ask({ lat: String(lat), lng: String(lng) }, signal).catch(() => []);
  return places[0] ?? null;
}

/** 이름으로 찾되 음식점·카페만(합쳐 30곳까지) — 가게 찾기 화면에서 씁니다. from(없으면 마지막 위치)에서 가까운 순. */
export async function searchFoodPlaces(query: string, signal?: AbortSignal, from?: Spot | null): Promise<FoodPlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const near = from ?? (await searchSpot());
  const res = await apiFetch(`/geocode?${new URLSearchParams({ q, food: "1", ...fromParam(near) })}`, { signal });
  if (!res.ok) throw new Error("가게 검색에 실패했습니다");
  const json = (await res.json()) as { places?: FoodPlace[] };
  return json.places ?? [];
}

/** 좌표 둘레의 음식점과 카페. 좌표는 이 요청에만 쓰고 저장하지 않습니다. */
export async function nearbyPlaces(lat: number, lng: number, signal?: AbortSignal): Promise<NearbyPlace[]> {
  const res = await apiFetch(
    `/geocode?${new URLSearchParams({ near: "1", lat: String(lat), lng: String(lng) })}`,
    { signal }
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { places?: NearbyPlace[] };
  return json.places ?? [];
}
