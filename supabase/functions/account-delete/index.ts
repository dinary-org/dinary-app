/**
 * account-delete — 옛 웹 /api/account/delete 를 옮긴 것. 회원 탈퇴.
 * auth.users 행을 지우면 restaurants·wishes·profiles 가 on delete cascade 로 함께 지워집니다.
 * 사진 파일은 그보다 먼저 지웁니다 — 어떤 파일이 내 것인지는 기록 · 프로필 행이 알려 주므로(account_photo_paths),
 * 계정을 지운 뒤에는 찾을 수 없습니다. 사진을 못 지우면 계정도 지우지 않고 실패로 돌려 다시 시도하게 합니다.
 *
 *   POST /functions/v1/account-delete   (Authorization: Bearer <세션 토큰>)
 *
 * (SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 넣어 줍니다)
 */
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { revokeAppleAuthorization } from "../_shared/apple-revoke.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "restaurant-photos";

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
  if (!token) return json({ error: "로그인이 필요합니다" }, { status: 401 });
  const admin = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { data: paths, error: listError } = await admin.rpc("account_photo_paths", { p_uid: user.id });
  if (listError) return json({ error: listError.message }, { status: 500 });
  const apple = user.identities?.find((identity) => identity.provider === "apple");
  if (apple) {
    const body = await req.json().catch(() => null);
    const subject = apple.identity_data?.sub;
    if (typeof subject !== "string") return json({ error: "Apple 계정 연결 정보를 확인하지 못했습니다. 삭제 요청 페이지로 문의해 주세요." }, { status: 409 });
    try {
      await revokeAppleAuthorization(body?.appleAuthorizationCode, subject);
    } catch (error) {
      // No data removal occurs if revocation/identity verification fails.
      return json({ error: error instanceof Error ? error.message : "Apple 연결을 해제하지 못했습니다" }, { status: 409 });
    }
  }

  const names = (paths ?? []) as string[];
  for (let i = 0; i < names.length; i += 100) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove(names.slice(i, i + 100));
    if (removeError) return json({ error: removeError.message }, { status: 500 });
  }

  const { error: signOutError } = await admin.auth.admin.signOut(token, "global");
  if (signOutError) return json({ error: "로그인 세션을 해제하지 못했습니다. 다시 로그인한 뒤 시도해 주세요." }, { status: 500 });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ ok: true });
});
