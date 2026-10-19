/**
 * account-delete — 옛 웹 /api/account/delete 를 옮긴 것. 회원 탈퇴.
 * auth.users 행을 지우면 restaurants·wishes·profiles 가 on delete cascade 로 함께 지워집니다.
 * 사진 스토리지 정리는 아직 미룬 일이라 여기서 손대지 않습니다.
 *
 *   POST /functions/v1/account-delete   (Authorization: Bearer <세션 토큰>)
 *
 * (SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 넣어 줍니다)
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region",
};
const json = (body: unknown, init: { status?: number } = {}) =>
  new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST 만 받습니다" }, { status: 405 });

  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const admin = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ ok: true });
});
