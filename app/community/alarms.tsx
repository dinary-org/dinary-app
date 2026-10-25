import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { showDialog } from "@/components/Dialog";
import { Text } from "@/components/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddPersonIcon } from "@/components/icons";
import { useAccount } from "@/data/profile";
import { useAlarms, useAlarmsSeen, type Alarm } from "@/features/community/alarms";
import { acceptFriend, removeFriend } from "@/features/community/api";
import { acceptCoupleRequest, declineCoupleRequest } from "@/features/couple/requests";
import { Avatar, CommunityHeader, K, RoundButton, timeAgo, TitleBlock } from "@/features/community/ui";
import { C, F, TAB_BAR_H } from "@/theme";

/**
 * 알림 — 친구 탭 종에서 엽니다. 받은 친구 신청(받기 · 거절) · 연인 신청(수락 · 거절) · 내 소식에 달린 댓글 · 공감을 최신순으로.
 * 댓글 · 공감을 누르면 친구 소식의 그 카드로(댓글이면 댓글 창까지) 갑니다.
 */
export default function AlarmsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data: account } = useAccount();
  const me = account?.userId ?? null;
  const { data: alarms = [], isPending, refetch, isRefetching } = useAlarms();
  const { seenAt, ready, markSeen } = useAlarmsSeen(me);
  const [busy, setBusy] = useState<string | null>(null);

  // 열 때의 「마지막으로 본 시각」을 붙들어 두고(그보다 새것에 점) 바로 지금으로 바꿉니다 — 종 점이 꺼집니다.
  const since = useRef<string | null>(null);
  const [marked, setMarked] = useState(false);
  useEffect(() => {
    if (!ready || marked) return;
    since.current = seenAt;
    setMarked(true);
    markSeen();
  }, [ready, marked, seenAt, markSeen]);
  const pending = (a: Alarm) => a.kind === "request" || a.kind === "couple";
  const isNew = (a: Alarm) => pending(a) || (marked && !!since.current && a.at > since.current);

  async function act(id: string, f: () => Promise<void>) {
    setBusy(id);
    try { await f(); } catch (e) { showDialog("잠시 뒤 다시 해 주세요", e instanceof Error ? e.message : ""); }
    setBusy(null);
  }

  function open(a: Alarm) {
    if (pending(a) || !me) return;
    Haptics.selectionAsync();
    router.navigate({
      pathname: "/community/friends",
      params: { only: me, post: String(a.postId), ...(a.kind === "comment" ? { comments: String(a.recordId) } : {}), t: String(Date.now()) },
    });
  }

  const btn = (label: string, onPress: () => void, dark: boolean, id: string) => (
    <Pressable onPress={onPress} disabled={busy === id} style={{ minHeight: 30, borderRadius: 15, paddingHorizontal: 12, justifyContent: "center", backgroundColor: dark ? C.ink : "transparent", borderWidth: dark ? 0 : 1, borderColor: C.line, opacity: busy === id ? 0.5 : 1 }}>
      <Text style={{ fontFamily: dark ? F.sansMd : F.sans, fontSize: 11.5, color: dark ? C.card : C.muted }}>{label}</Text>
    </Pressable>
  );

  const line = (a: Alarm) => {
    const name = <Text style={{ fontFamily: F.sansMd, color: C.ink }}>{a.who.nickname}</Text>;
    switch (a.kind) {
      case "request": return <>{name}님이 친구 신청을 보냈어요</>;
      case "couple": return <>{name}님이 연인 기록을 함께 쓰자고 해요</>;
      case "comment": return <>{name}님이 <Text style={{ color: C.ink }}>{a.place}</Text> 소식에 댓글을 남겼어요</>;
      case "cheer": return <>{name}님이 <Text style={{ color: C.ink }}>{a.place}</Text> 소식에 공감했어요</>;
    }
  };

  const row = ({ item: a }: { item: Alarm }) => (
    <Pressable
      onPress={() => open(a)}
      disabled={pending(a)}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.lineSoft }}
    >
      <Avatar name={a.who.nickname} url={a.who.avatarUrl} size={38} seed={a.who.id} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: K.text2 }}>{line(a)}</Text>
        {a.kind === "comment" && <Text numberOfLines={2} style={{ fontFamily: F.sans, fontSize: 12.5, color: C.muted }}>「{a.body}」</Text>}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          {isNew(a) && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.brick }} />}
          <Text style={{ fontFamily: F.mono, fontSize: 10.5, color: C.faint }}>{timeAgo(a.at)}</Text>
        </View>
      </View>
      {a.kind === "request" && (
        <View style={{ flexDirection: "row", gap: 6 }}>
          {btn("거절", () => act(a.key, () => removeFriend(qc, a.who.id)), false, a.key)}
          {btn("받기", () => act(a.key, () => acceptFriend(qc, a.who.id)), true, a.key)}
        </View>
      )}
      {a.kind === "couple" && (
        <View style={{ flexDirection: "row", gap: 6 }}>
          {btn("거절", () => declineCoupleRequest(qc, a.request), false, a.key)}
          {btn("수락", () => acceptCoupleRequest(qc, a.request), true, a.key)}
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <CommunityHeader
        back={{ label: "친구", onPress: () => (router.canGoBack() ? router.back() : router.navigate("/community/friends")) }}
        right={<RoundButton label="친구 추가" onPress={() => router.push("/community/people")}><AddPersonIcon /></RoundButton>}
      />
      <FlatList
        data={alarms}
        keyExtractor={(a) => a.key}
        renderItem={row}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListHeaderComponent={<View style={{ marginHorizontal: -20, marginBottom: 6 }}><TitleBlock eyebrow="FRIENDS" title="알림" /></View>}
        ListEmptyComponent={isPending ? null : (
          <Text style={{ paddingVertical: 40, textAlign: "center", fontFamily: F.sans, fontSize: 12.5, color: C.faint }}>
            아직 알림이 없습니다.{"\n"}친구 · 연인 신청 · 내 소식에 달린 댓글 · 공감이 여기 모입니다.
          </Text>
        )}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_BAR_H + insets.bottom + 32 }}
      />
    </View>
  );
}
