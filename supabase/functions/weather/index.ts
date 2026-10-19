/**
 * weather — 옛 웹 /api/weather 를 옮긴 것. 추천 탭의 날씨 — 기상청 단기예보 조회서비스의 초단기실황(getUltraSrtNcst, 공공데이터포털).
 * KMA_SERVICE_KEY(공공데이터포털 「일반 인증키(Decoding)」)가 없거나 기상청이 실패하면 weather: null 을 돌려주고,
 * 앱은 날씨 성분을 중립으로 둡니다 — 값을 지어내지 않습니다. 좌표는 격자로 바꾸는 데만 쓰고 남기지 않습니다.
 * 같은 격자 · 같은 발표 시각은 20분 동안 (함수 인스턴스) 메모리에 둡니다.
 *
 * 환경변수(Edge Function secrets): KMA_SERVICE_KEY
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region",
};
const json = (body: unknown, init: { status?: number } = {}) =>
  new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });

const KEY = Deno.env.get("KMA_SERVICE_KEY")?.trim();
const URL_NCST = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";
const TTL_MS = 20 * 60 * 1000;

type Weather = { tempC: number | null; rainMm: number | null; precip: boolean; observedAt: string };
const cache = new Map<string, { at: number; weather: Weather }>();

/** 위경도 → 기상청 동네예보 격자(Lambert 정각원추, 기상청 공개 변환식). */
function toGrid(lat: number, lng: number) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const D = Math.PI / 180;
  const re = RE / GRID;
  const s1 = SLAT1 * D, s2 = SLAT2 * D, olon = OLON * D, olat = OLAT * D;
  let sn = Math.tan(Math.PI * 0.25 + s2 * 0.5) / Math.tan(Math.PI * 0.25 + s1 * 0.5);
  sn = Math.log(Math.cos(s1) / Math.cos(s2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + s1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(s1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * D * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lng * D - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) };
}

/** 실황은 매시 정각 자료가 40분쯤 올라옵니다 — 45분 전이면 한 시간 앞 자료. 한국 시간. */
function baseTime(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000 - (now.getUTCMinutes() < 45 ? 3600 * 1000 : 0));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}`,
    time: `${pad(kst.getUTCHours())}00`,
    iso: `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:00:00+09:00`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!sp.get("lat") || !sp.get("lng") || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: "invalid lat/lng" }, { status: 400 });
  }
  // 한반도 밖은 격자가 없습니다.
  if (lat < 32 || lat > 39.5 || lng < 124 || lng > 132) return json({ weather: null, reason: "out_of_range" });
  if (!KEY) return json({ weather: null, reason: "not_configured" });

  const { nx, ny } = toGrid(lat, lng);
  const base = baseTime();
  const key = `${nx},${ny},${base.date}${base.time}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return json({ weather: hit.weather });

  try {
    const params = new URLSearchParams({ serviceKey: KEY, pageNo: "1", numOfRows: "20", dataType: "JSON", base_date: base.date, base_time: base.time, nx: String(nx), ny: String(ny) });
    const res = await fetch(`${URL_NCST}?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return json({ weather: null, reason: `kma_${res.status}` });
    const body = await res.json();
    if (body?.response?.header?.resultCode !== "00") return json({ weather: null, reason: `kma_${body?.response?.header?.resultCode ?? "bad"}` });
    const items: { category: string; obsrValue: string }[] = body?.response?.body?.items?.item ?? [];
    const val = (c: string) => {
      const v = items.find((i) => i.category === c)?.obsrValue;
      const n = v == null ? NaN : Number(v);
      return Number.isFinite(n) && n > -900 ? n : null;
    };
    const pty = val("PTY");
    if (pty == null && val("T1H") == null) return json({ weather: null, reason: "kma_empty" });
    const weather: Weather = { tempC: val("T1H"), rainMm: val("RN1"), precip: pty != null && pty > 0, observedAt: base.iso };
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), weather });
    return json({ weather });
  } catch {
    return json({ weather: null, reason: "kma_unreachable" });
  }
});
