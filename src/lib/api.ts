import { supabase } from "./supabase";

const BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * Supabase Edge Function 호출(geocode · weather · recommend-candidates · account-delete).
 * Supabase 세션 토큰을 Authorization: Bearer 로 실어 보내고(함수가 JWT 를 검증합니다),
 * 카카오 · 기상청이 가까운 서울 리전에서 돌게 합니다(x-region).
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  headers.set("apikey", ANON);
  headers.set("x-region", "ap-northeast-2");
  return fetch(`${BASE}${path}`, { ...init, headers });
}
