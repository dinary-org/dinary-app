/**
 * 주소 · 상호 검색 목록 — 250ms 쉬면 첫 쪽(가까운 15곳 + 주소)을 찾고, 목록 끝까지 내리면 다음 쪽을 덧붙입니다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { searchPlaces, type Place } from "./geocode";

export function usePlaceSearch(query: string, enabled = true) {
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const paging = useRef<{ q: string; page: number; more: boolean; loading: boolean }>({ q: "", page: 0, more: false, loading: false });

  useEffect(() => {
    const q = query.trim();
    paging.current = { q, page: 0, more: false, loading: false };
    if (!enabled || q.length < 2) { setResults([]); setBusy(false); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const { places, more } = await searchPlaces(q, 1, ctrl.signal);
        if (ctrl.signal.aborted) return;
        paging.current = { q, page: 1, more, loading: false };
        setResults(places);
      } catch { /* 취소·오프라인 */ } finally { if (!ctrl.signal.aborted) setBusy(false); }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, enabled]);

  const loadMore = useCallback(async () => {
    const p = paging.current;
    if (!p.more || p.loading) return;
    p.loading = true;
    try {
      const { places, more } = await searchPlaces(p.q, p.page + 1, undefined);
      if (paging.current !== p) return; // 그새 검색어가 바뀜
      p.page += 1; p.more = more;
      const seen = new Set<string>();
      setResults((prev) => [...prev, ...places].filter((x) => {
        const key = `${x.lat.toFixed(5)},${x.lng.toFixed(5)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }));
    } catch { /* 오프라인 — 다시 내리면 또 시도 */ } finally { p.loading = false; }
  }, []);

  const clear = useCallback(() => { paging.current = { q: "", page: 0, more: false, loading: false }; setResults([]); }, []);

  return { results, busy, loadMore, clear };
}
