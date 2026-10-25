import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import { iGa } from "@/lib/josa";
import { useActiveBook } from "@/data/books";
import { CHANNEL, ensureChannel } from "@/features/notify/channel";
import { pushPoke } from "@/features/notify/push";

/** 콕 찌르기 — 한 줄을 나만 쓴 기록에서 상대에게. 다시 찌르면 시각만 새로(안 본 상태로). */
export async function sendPoke(bookId: string, recordId: number, toUser: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("로그인이 필요합니다");
  const { error } = await supabase.from("pokes").upsert(
    { record_id: recordId, from_user: session.user.id, to_user: toUser, book_id: bookId, created_at: new Date().toISOString(), seen_at: null },
    { onConflict: "record_id,from_user" }
  );
  if (error) throw new Error(error.message);
  pushPoke(recordId);
}

/**
 * 받은 콕 찌르기 — 앱이 앞으로 올 때마다 안 본 것을 읽어 기기 알림으로 띄웁니다.
 * 앱 실행 중 같은 찌르기는 한 번만 표시하고, 기록을 열면 읽음 처리합니다.
 * 푸시를 못 받은 기기(권한 없음 · FCM 없는 안드로이드)는 앱을 열 때 여기서 알려 줍니다.
 */
export function usePokeInbox() {
  const { books, me } = useActiveBook();
  const couple = books?.couple ?? null;
  const busy = useRef(false);
  const shown = useRef(new Set<string>());
  useEffect(() => {
    if (!me?.userId || !couple) return;
    const names = new Map(couple.members.map((m) => [m.userId, m.nickname]));
    async function check() {
      if (busy.current) return;
      busy.current = true;
      try {
        const { data } = await supabase
          .from("pokes")
          .select("record_id, from_user, created_at, restaurants(name)")
          .eq("to_user", me!.userId)
          .is("seen_at", null);
        if (data?.length) await ensureChannel();
        for (const p of data ?? []) {
          const key = `${me!.userId}:${p.record_id}:${p.from_user}:${p.created_at}`;
          if (shown.current.has(key) || !(await Notifications.getPermissionsAsync()).granted) continue;
          const place = (p.restaurants as { name?: string } | null)?.name ?? "기록";
          await Notifications.scheduleNotificationAsync({
            content: { title: `${iGa(names.get(p.from_user) ?? "상대")} 콕 찔렀어요`, body: `${place}에 한 줄을 남겨 주세요`, data: { recordId: p.record_id, recipientId: me!.userId } },
            trigger: { channelId: CHANNEL },
          });
          shown.current.add(key);
        }
      } catch {
        // Retry on the next foreground event; do not mark an undelivered poke read.
      } finally {
        busy.current = false;
      }
    }
    void check();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void check(); });
    return () => sub.remove();
  }, [me?.userId, couple]);
}
