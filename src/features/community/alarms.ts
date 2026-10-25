import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { fetchCoupleRequests, type CoupleRequest } from "@/data/books";
import { DEFAULT_CHARACTER, isCharacterId } from "@/lib/characters";
import { supabase } from "@/lib/supabase";
import type { PublicProfile } from "./api";

/**
 * 친구 탭 종 — 받은 친구 신청 · 연인 신청 · 내 소식에 달린 댓글 · 공감. 따로 쌓는 표 없이 friendships · record_comments · record_cheers 를 모아 읽습니다.
 * 「새 알림」 기준(마지막으로 알림을 연 시각)은 기기에만 둡니다.
 */
export type Alarm =
  | { key: string; kind: "request"; who: PublicProfile; at: string }
  | { key: string; kind: "couple"; who: PublicProfile; at: string; request: CoupleRequest }
  | { key: string; kind: "comment"; who: PublicProfile; at: string; postId: number; recordId: number; place: string; body: string }
  | { key: string; kind: "cheer"; who: PublicProfile; at: string; postId: number; recordId: number; place: string };

type ProfileRow = { id: string; nickname: string | null; avatar_url: string | null; character_id: string | null; title_label_id: string | null };

const toProfile = (p: ProfileRow): PublicProfile => ({
  id: p.id,
  nickname: p.nickname ?? "",
  avatarUrl: p.avatar_url,
  characterId: isCharacterId(p.character_id) ? p.character_id : DEFAULT_CHARACTER,
  titleLabelId: p.title_label_id,
  leaderboardOptIn: false,
});

export const useAlarms = () =>
  useQuery({
    queryKey: ["community", "alarms"],
    queryFn: async (): Promise<Alarm[]> => {
      const { data: s } = await supabase.auth.getSession();
      const me = s.session?.user.id;
      if (!me) return [];
      const [{ data: reqs }, { data: posts }, couples] = await Promise.all([
        supabase.from("friendships").select("user_id, created_at").eq("friend_id", me).eq("status", "pending"),
        supabase.from("friend_feed").select("id, record_id, name").eq("user_id", me),
        fetchCoupleRequests(),
      ]);
      const mine = new Map(((posts ?? []) as { id: number; record_id: number; name: string }[]).map((p) => [p.record_id, p]));
      const ids = [...mine.keys()];
      const [{ data: comments }, { data: cheers }] = ids.length
        ? await Promise.all([
            supabase.from("record_comments").select("id, record_id, user_id, body, created_at").in("record_id", ids).neq("user_id", me).order("created_at", { ascending: false }).limit(100),
            supabase.from("record_cheers").select("record_id, user_id, created_at").in("record_id", ids).neq("user_id", me).order("created_at", { ascending: false }).limit(100),
          ])
        : [{ data: [] }, { data: [] }];
      const R = (reqs ?? []) as { user_id: string; created_at: string }[];
      const Cm = (comments ?? []) as { id: number; record_id: number; user_id: string; body: string; created_at: string }[];
      const Ch = (cheers ?? []) as { record_id: number; user_id: string; created_at: string }[];
      const out: Alarm[] = couples.map((r) => ({ key: `p${r.code}`, kind: "couple", who: toProfile(r.inviter), at: r.created_at, request: r }));
      const who = [...new Set([...R, ...Cm, ...Ch].map((r) => r.user_id))];
      if (!who.length) return out;
      const { data: ps } = await supabase.from("public_profiles").select("*").in("id", who);
      const byId = new Map(((ps ?? []) as ProfileRow[]).map((p) => [p.id, toProfile(p)]));

      for (const r of R) {
        const p = byId.get(r.user_id);
        if (p) out.push({ key: `r${r.user_id}`, kind: "request", who: p, at: r.created_at });
      }
      for (const c of Cm) {
        const p = byId.get(c.user_id);
        const post = mine.get(c.record_id);
        if (p && post) out.push({ key: `c${c.id}`, kind: "comment", who: p, at: c.created_at, postId: post.id, recordId: c.record_id, place: post.name, body: c.body });
      }
      for (const c of Ch) {
        const p = byId.get(c.user_id);
        const post = mine.get(c.record_id);
        if (p && post) out.push({ key: `h${c.record_id}.${c.user_id}`, kind: "cheer", who: p, at: c.created_at, postId: post.id, recordId: c.record_id, place: post.name });
      }
      return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100);
    },
  });

const seenKey = (userId: string) => `dinary.alarmsSeen.${userId}`;

/** 마지막으로 알림을 연 시각. 처음 읽을 때(저장된 값이 없을 때)는 지금으로 둡니다 — 업데이트 직후 지난 댓글이 전부 「새로」가 되지 않게. */
export function useAlarmsSeen(userId: string | null | undefined) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["alarms-seen", userId],
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: async (): Promise<string | null> => AsyncStorage.getItem(seenKey(userId!)).catch(() => null),
  });
  const markSeen = useCallback(() => {
    if (!userId) return;
    const now = new Date().toISOString();
    qc.setQueryData(["alarms-seen", userId], now);
    void AsyncStorage.setItem(seenKey(userId), now).catch(() => {});
  }, [qc, userId]);
  const first = q.isSuccess && q.data === null;
  useEffect(() => { if (first) markSeen(); }, [first, markSeen]);
  return { seenAt: q.data ?? null, ready: q.isSuccess && q.data !== null, markSeen };
}

/** 종 위 점 — 받은 신청(친구 · 연인)이 있거나, 마지막으로 연 뒤 새 댓글 · 공감이 왔을 때. */
export function useAlarmDot(userId: string | null | undefined) {
  const { data: alarms = [] } = useAlarms();
  const { seenAt, ready } = useAlarmsSeen(userId);
  return alarms.some((a) => a.kind === "request" || a.kind === "couple" || (ready && !!seenAt && a.at > seenAt));
}
