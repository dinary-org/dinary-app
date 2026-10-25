/**
 * push-send — Expo 푸시로 알림 보내기.
 *
 *   POST /functions/v1/push-send   (Authorization: Bearer <세션 토큰>)
 *   { kind: "poke", recordId }  — 방금 콕 찌른 상대에게. 보낸 사람이 실제로 찌른 기록(pokes)만 보냅니다.
 *                                 한 기기라도 받으면 seen_at 을 채워, 받은 사람이 앱을 열 때 다시 띄우지 않게 합니다.
 *   { kind: "test" }            — 운영자만, 운영자 자신의 기기에 지금 앱의 알림 세 가지를 견본으로.
 *
 * (SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 넣어 줍니다)
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region",
};
const json = (body: unknown, init: { status?: number } = {}) =>
  new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });

type Message = { title: string; body: string; data?: Record<string, unknown> };
type Ticket = { status: "ok" | "error"; message?: string; details?: { error?: string } };

/** 이/가 — 받침이 있으면 「이」. */
const iGa = (name: string) => {
  const c = name.charCodeAt(name.length - 1);
  return `${name}${c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? "이" : "가"}`;
};

// deno-lint-ignore no-explicit-any
async function send(admin: any, userId: string, messages: Message[]) {
  const { data: rows } = await admin.from("push_tokens").select("token").eq("user_id", userId);
  const tokens = ((rows ?? []) as { token: string }[]).map((r) => r.token);
  if (!tokens.length) return { sent: 0, tokens: 0, errors: [] as string[] };
  const batch = tokens.flatMap((to) => messages.map((m) => ({ to, sound: "default", ...m })));
  const res = await fetch(EXPO_PUSH, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(batch) });
  const out = await res.json().catch(() => null) as { data?: Ticket[] } | null;
  const tickets = out?.data ?? [];
  // 앱을 지운 기기 — 토큰을 정리합니다.
  const dead = tickets.flatMap((t, i) => (t.details?.error === "DeviceNotRegistered" ? [batch[i].to] : []));
  if (dead.length) await admin.from("push_tokens").delete().in("token", dead);
  return {
    sent: tickets.filter((t) => t.status === "ok").length,
    tokens: tokens.length,
    errors: tickets.flatMap((t) => (t.status === "error" ? [t.details?.error ?? t.message ?? "error"] : [])),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST 만 받습니다" }, { status: 405 });

  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const admin = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "로그인이 필요합니다" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { kind?: string; recordId?: number };

  if (body.kind === "poke") {
    const { data: poke } = await admin
      .from("pokes")
      .select("record_id, to_user, created_at, restaurants(name)")
      .eq("record_id", body.recordId ?? -1)
      .eq("from_user", user.id)
      .maybeSingle();
    if (!poke) return json({ error: "찌른 기록이 없습니다" }, { status: 404 });
    if (Date.now() - new Date(poke.created_at).getTime() > 5 * 60_000) return json({ error: "오래된 찌르기입니다" }, { status: 409 });
    const { data: me } = await admin.from("profiles").select("nickname").eq("id", user.id).maybeSingle();
    const place = (poke.restaurants as { name?: string } | null)?.name ?? "기록";
    const result = await send(admin, poke.to_user, [{
      title: `${iGa(me?.nickname ?? "상대")} 콕 찔렀어요`,
      body: `${place}에 한 줄을 남겨 주세요`,
      data: { recordId: poke.record_id },
    }]);
    if (result.sent > 0) {
      await admin.from("pokes").update({ seen_at: new Date().toISOString() }).eq("record_id", poke.record_id).eq("from_user", user.id);
    }
    return json(result);
  }

  if (body.kind === "test") {
    const { data: me } = await admin.from("profiles").select("nickname, role").eq("id", user.id).maybeSingle();
    if (me?.role !== "admin") return json({ error: "운영자만 보낼 수 있습니다" }, { status: 403 });
    const name = me.nickname ?? "나";
    const result = await send(admin, user.id, [
      { title: "[시험] 담아둔 곳, 지금 앞에 계신가요?", body: "눌러서 사진을 찍으면 방문이 인증됩니다." },
      { title: `[시험] ${iGa(name)} 콕 찔렀어요`, body: "가게에 한 줄을 남겨 주세요" },
      { title: "[시험] 기록을 완성해보는 거 어때요?", body: `${name}님이 아직 완성하지 않은 기록이 2개 있어요.` },
    ]);
    return json(result);
  }

  return json({ error: "알 수 없는 kind" }, { status: 400 });
});
