import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/Text";
import { CheckIcon, CrossIcon } from "@/components/icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAccount, useSetLeaderboardOptIn } from "@/data/profile";
import { useLeaderboard, type Period, type Scope } from "@/features/community/api";
import { BOARDS, periodLabel, SCOPES, type BoardMeta } from "@/features/community/boards";
import { CommunityHeader, K, MiniSegment, Pill, TitleBlock } from "@/features/community/ui";
import { C, F, FAINT_BOLD, TAB_BAR_H } from "@/theme";
import { useTabTutorial, useTutorialTarget } from "@/features/tutorial/TutorialProvider";
import { COMMUNITY_DELAY } from "@/features/tutorial/steps";
import { getUserItem, setUserItem } from "@/lib/userStore";

const ASKED_KEY = "community.ranking.asked";
/** 랭킹은 주 단위로만 잽니다. */
const PERIOD: Period = "week";

/** 랭킹 — 참여한 사람끼리만, 숫자만(핸드오프 §7 · 3a · 3b). */
export default function RankingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: account } = useAccount();
  const setOptIn = useSetLeaderboardOptIn();
  const [scope, setScope] = useState<Scope>("friends");
  const [asking, setAsking] = useState(false);
  const optIn = account?.leaderboardOptIn ?? false;
  // 참여 묻는 창이 먼저 — 답한 뒤에 튜토리얼.
  useTabTutorial("community.ranking", COMMUNITY_DELAY, !asking);
  const listSpot = useTutorialTarget("community.ranking.list");
  const joinSpot = useTutorialTarget("community.ranking.join");

  // 계정마다 처음 들어올 때 한 번만 묻습니다(기본은 구경만).
  useEffect(() => {
    if (!account || account.leaderboardOptIn) return;
    getUserItem(account.userId, ASKED_KEY).then((v) => { if (!v) setAsking(true); }).catch(() => setAsking(true));
  }, [account]);

  async function answer(on: boolean) {
    setAsking(false);
    if (account) setUserItem(account.userId, ASKED_KEY, "1").catch(() => {});
    if (account && on !== account.leaderboardOptIn) await setOptIn(account.userId, on).catch(() => {});
  }

  const open = (b: BoardMeta) => router.push({ pathname: "/community/ranking/[board]", params: { board: b.id, scope } });

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <CommunityHeader
        right={
          <View ref={joinSpot} collapsable={false}>
          <Pill
            label={optIn ? "참여 중" : "구경 중"}
            accessibilityLabel={optIn ? "랭킹 참여 중 — 눌러서 그만두기" : "구경 중 — 눌러서 랭킹 참여"}
            onPress={() => account && setOptIn(account.userId, !optIn).catch(() => {})}
          >
            {optIn && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.brick }} />}
          </Pill>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_H + insets.bottom + 24 }}>
        <TitleBlock eyebrow="RANKING" />
        <View style={{ marginTop: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: F.sansMd, fontSize: 12.5, color: C.ink }}>{periodLabel(PERIOD)}</Text>
          <MiniSegment value={scope} options={SCOPES} onChange={setScope} />
        </View>
        <View ref={listSpot} collapsable={false} style={{ marginTop: 14, paddingHorizontal: 16, gap: 8 }}>
          {BOARDS.map((b) => <BoardCard key={b.id} board={b} period={PERIOD} scope={scope} me={optIn ? account?.userId : undefined} onPress={() => open(b)} />)}
        </View>
      </ScrollView>

      <OptInSheet visible={asking} onJoin={() => answer(true)} onWatch={() => answer(false)} />
    </View>
  );
}

/** 랭킹 카드 — 이름 · 세는 법, 1–3위, 내 순위(참여하지 않았으면 —). */
function BoardCard({ board, period, scope, me, onPress }: { board: BoardMeta; period: Period; scope: Scope; me?: string; onPress: () => void }) {
  const { data: rows = [], isPending } = useLeaderboard(board.id, period, scope);
  const top = rows.slice(0, 3).map((r) => `${r.rank} ${r.nickname}`).join(" · ");
  const mine = me ? rows.find((r) => r.user_id === me) : undefined;
  return (
    <Pressable onPress={onPress} style={{ borderRadius: 18, borderWidth: 1, borderColor: C.lineSoft, backgroundColor: C.card, paddingVertical: 11, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Text style={[{ fontFamily: F.serif, fontSize: 15, color: C.ink }, FAINT_BOLD]}>{board.name}</Text>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.sans, fontSize: 11, color: C.faint }}>{board.rule}</Text>
        </View>
        <Text numberOfLines={1} style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 0.3, color: C.muted }}>{isPending ? " " : top || "아직 아무도 없습니다"}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1.6, color: K.inactive }}>나</Text>
        <Text style={[{ fontFamily: F.serif, fontSize: 19, color: mine ? C.brick : K.dashed }, mine && { ...FAINT_BOLD, textShadowColor: C.brick }]}>{mine ? `${mine.rank}위` : "—"}</Text>
      </View>
    </Pressable>
  );
}

/** 처음 들어올 때 — 참여할지 묻는 시트(3a). 42% 먹색 막 위. */
function OptInSheet({ visible, onJoin, onWatch }: { visible: boolean; onJoin: () => void; onWatch: () => void }) {
  const insets = useSafeAreaInsets();
  const check = (on: boolean, label: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: on ? C.ink : "transparent", borderWidth: on ? 0 : 1, borderColor: K.dashed }}>
        {on ? <CheckIcon size={10} stroke={C.card} /> : <CrossIcon size={8} stroke={K.inactive} />}
      </View>
      <Text style={{ flexShrink: 1, fontFamily: F.sans, fontSize: 12, color: on ? C.ink : C.faint }}>{label}</Text>
    </View>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onWatch} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,26,23,.42)" }}>
        <View style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: C.card, paddingTop: 12, paddingHorizontal: 22, paddingBottom: Math.max(38, insets.bottom + 20) }}>
          <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: C.line }} />
          <Text style={{ marginTop: 18, fontFamily: F.mono, fontSize: 10, letterSpacing: 1.6, color: C.faint }}>LEADERBOARD</Text>
          <Text style={{ marginTop: 8, fontFamily: F.serif, fontSize: 21, lineHeight: 28, color: C.ink }}>랭킹에 참여할까요?</Text>
          <Text style={{ marginTop: 8, fontFamily: F.sans, fontSize: 12.5, lineHeight: 22, color: C.muted }}>DINARY 는 혼자 쓰는 일기에서 시작합니다. 참여하지 않아도 랭킹은 볼 수 있고, 내 기록은 그대로입니다.</Text>
          <View style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, borderRadius: 16, backgroundColor: C.paper, padding: 12, gap: 8 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.6, color: C.brick }}>보이는 것</Text>
              {check(true, "닉네임 · 캐릭터 · 칭호")}
              {check(true, "랭킹별 숫자")}
            </View>
            <View style={{ flex: 1, borderRadius: 16, backgroundColor: C.paper, padding: 12, gap: 8 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.6, color: C.faint }}>안 보이는 것</Text>
              {check(false, "사진 · 메모 · 별점")}
              {check(false, "가게 이름 · 위치")}
            </View>
          </View>
          <View style={{ marginTop: 18, gap: 8 }}>
            <Pressable onPress={onJoin} style={{ minHeight: 50, borderRadius: 18, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: F.sansMd, fontSize: 14, color: C.card }}>참여하기</Text>
            </Pressable>
            <Pressable onPress={onWatch} style={{ minHeight: 46, borderRadius: 18, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: F.sans, fontSize: 13, color: K.text2 }}>구경만 할게요</Text>
            </Pressable>
          </View>
          <Text style={{ marginTop: 10, textAlign: "center", fontFamily: F.sans, fontSize: 11, color: K.inactive }}>내계정 › 랭킹 참여에서 언제든 바꿀 수 있습니다</Text>
        </View>
      </View>
    </Modal>
  );
}
