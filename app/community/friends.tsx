import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { showDialog } from "@/components/Dialog";
import { Text } from "@/components/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddPersonIcon, BellLineIcon, BookmarkIcon } from "@/components/icons";
import { PaperMap } from "@/components/PaperMap";
import { BottomSheetModal } from "@/components/ui";
import { useAccount } from "@/data/profile";
import { useWishes } from "@/data/queries";
import { useAppState } from "@/data/store";
import {
  blockUser, postPhotos, removeFriendPost, report, REPORT_REASONS, toggleCheer, upsertFriendPost, useFriendFeed, useFriends, useRecordSocial,
  type FriendPost, type WishSeed,
} from "@/features/community/api";
import { useAlarmDot } from "@/features/community/alarms";
import CommentsSheet from "@/features/community/Comments";
import PostSheet from "@/features/community/PostSheet";
import { useAddWish, type WishResult } from "@/features/community/useAddWish";
import { Avatar, CommunityHeader, K, LikeButton, metaLine, monthDay, PhotoOrStripes, RoundButton, Segmented, shortAddr, timeAgo, TitleBlock, VerifiedChip } from "@/features/community/ui";
import { formatDistance, metersBetween } from "@/features/capture/logic";
import { FriendMarker, friendPinSize } from "@/features/map/Markers";
import { matchWish, type Wish } from "@/lib/types";
import { C, F, SHADOW, TAB_BAR_H } from "@/theme";
import { SignedImage } from "@/lib/signedPhoto";
import { useTabTutorial, useTutorialTarget } from "@/features/tutorial/TutorialProvider";
import { COMMUNITY_DELAY } from "@/features/tutorial/steps";

type View_ = "feed" | "map";
type OnWish = (seed: WishSeed) => Promise<WishResult | null>;
type Who = { id: string; nickname: string; avatarUrl: string | null };

/**
 * 친구 — 커뮤니티 첫 화면(HANDOFF-friend-posts §3). 친구가 직접 골라 올린 소식(friend_feed)만 최신순으로.
 * 맨 앞 얼굴은 내 자리 — 「+」로 소식을 올립니다.
 */
export default function FriendsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { communitySeenSince } = useAppState();
  // 첫 실행 튜토리얼 — 커뮤니티 메뉴 · 친구 소식 줄 · 소식/친구 지도.
  useTabTutorial("community.friends", COMMUNITY_DELAY);
  const storySpot = useTutorialTarget("community.stories");
  const segmentSpot = useTutorialTarget("community.segment");
  const { data: fr } = useFriends();
  const { data: account } = useAccount();
  const { data: posts = [] } = useFriendFeed();
  const [view, setView] = useState<View_>("feed");
  const [only, setOnly] = useState<string | null>(null);
  // 프로필 창 「친구 · 기록 보기」 — 그 친구만 거른 소식으로 엽니다(?only=).
  // 알림 — 내 소식 카드로(?post=), 댓글이면 댓글 창까지(?comments=). t 는 같은 알림을 다시 눌러도 다시 돌게.
  const { only: onlyParam, post: postParam, comments: commentsParam, t: navT } = useLocalSearchParams<{ only?: string; post?: string; comments?: string; t?: string }>();
  useEffect(() => { if (onlyParam) setOnly(onlyParam); }, [onlyParam, navT]);
  const [commentsFor, setCommentsFor] = useState<number | null>(null);
  useEffect(() => {
    if (postParam) { setView("feed"); setScrollTo(Number(postParam)); }
    if (commentsParam) setCommentsFor(Number(commentsParam));
  }, [postParam, commentsParam, navT]);
  const [posting, setPosting] = useState<{ recordId: number | null } | null>(null);
  const [menuFor, setMenuFor] = useState<FriendPost | null>(null);
  const [menuStep, setMenuStep] = useState<"main" | "report">("main");
  const [removed, setRemoved] = useState<FriendPost | null>(null);
  const [scrollTo, setScrollTo] = useState<number | null>(null);
  const listRef = useRef<FlatList<FriendPost>>(null);
  // 위시에 담기 — 연인 기록장이 있으면 내 위시 / 우리 위시를 한 번 묻습니다.
  const { add: addWish, sheet: wishSheet } = useAddWish();

  const me = account?.userId ?? fr?.me ?? null;
  const alarmDot = useAlarmDot(me);
  const friends = fr?.friends ?? [];
  const people = useMemo(() => {
    const m = new Map<string, Who>(friends.map((f) => [f.id, f]));
    if (me) m.set(me, { id: me, nickname: account?.nickname || "나", avatarUrl: account?.avatarUrl ?? null });
    return m;
  }, [friends, me, account]);

  // 친구 소식 + 내 소식(친구 목록에 없는 사람의 소식은 빼고)
  const feed = useMemo(() => posts.filter((p) => p.user_id === me || people.has(p.user_id)), [posts, people, me]);
  const mine = feed.filter((p) => p.user_id === me);
  const isNew = (p: FriendPost) => p.user_id !== me && (!communitySeenSince || p.created_at > communitySeenSince);
  const fresh = feed.filter(isNew);
  const freshBy = new Set(fresh.map((p) => p.user_id));
  // 새 소식이 있는 친구를 앞으로.
  const row = [...friends].sort((a, b) => Number(freshBy.has(b.id)) - Number(freshBy.has(a.id)));
  const shown = only ? feed.filter((p) => p.user_id === only) : feed;

  useEffect(() => {
    if (removed == null) return;
    const t = setTimeout(() => setRemoved(null), 4000);
    return () => clearTimeout(t);
  }, [removed]);

  // 「소식에서 보기」 — 피드로 돌아와 그 카드로 스크롤
  useEffect(() => {
    if (scrollTo == null || view !== "feed") return;
    const i = shown.findIndex((p) => p.id === scrollTo);
    setScrollTo(null);
    if (i >= 0) requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: i, viewPosition: 0, animated: true }));
  }, [scrollTo, view, shown]);

  const closeMenu = () => { setMenuFor(null); setMenuStep("main"); };
  /** 시트가 다 내려간 뒤에 창을 — 내려가는 시트 위로는 iOS 가 못 띄웁니다. */
  const later = (f: () => void) => setTimeout(f, 380);

  // 남의 소식 — 신고(사유 고르기) · 차단(그 사람의 소식 · 댓글 · 기록이 내 화면에서 바로 빠짐).
  function reportPost(p: FriendPost, reason: string) {
    closeMenu();
    report("friend_post", p.id, reason).then(
      () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); later(() => showDialog("신고했습니다 · 살펴본 뒤 처리합니다")); },
      (e: unknown) => later(() => showDialog("잠시 뒤 다시 해 주세요", e instanceof Error ? e.message : "")),
    );
  }

  function block(p: FriendPost) {
    closeMenu();
    const name = people.get(p.user_id)?.nickname ?? "이 사람";
    later(() => showDialog(`${name}님을 차단할까요?`, "이 사람의 소식 · 글 · 댓글 · 기록이 내 화면에서 빠집니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "차단하기", style: "destructive",
        onPress: () => blockUser(qc, p.user_id).then(
          () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); if (only === p.user_id) setOnly(null); },
          (e: unknown) => showDialog("잠시 뒤 다시 해 주세요", e instanceof Error ? e.message : ""),
        ),
      },
    ]));
  }

  async function takeDown(p: FriendPost) {
    closeMenu();
    try {
      await removeFriendPost(qc, p.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRemoved(p);
    } catch {
      // 실패하면 그대로 둡니다.
    }
  }

  async function undo() {
    const p = removed;
    setRemoved(null);
    if (p) await upsertFriendPost(qc, { recordId: p.record_id, photoIndex: p.photo_index, note: p.note ?? "" }).catch(() => {});
  }

  const right = (
    <>
      <RoundButton label="친구 추가" onPress={() => router.push("/community/people")}><AddPersonIcon /></RoundButton>
      <RoundButton label="알림" dot={alarmDot} onPress={() => router.push("/community/alarms")}>
        <BellLineIcon />
      </RoundButton>
    </>
  );

  const head = (
    <View>
      <TitleBlock
        eyebrow="FRIENDS"
        aside={<Text style={{ fontFamily: F.sans, fontSize: 12, color: C.faint }}>친구 {friends.length}명 · 새 소식 {fresh.length}</Text>}
      />
      <View ref={segmentSpot} collapsable={false} style={{ marginTop: 14, marginHorizontal: 20 }}>
        <Segmented<View_>
          value={view}
          onChange={setView}
          options={[{ id: "feed", label: "소식" }, { id: "map", label: "친구 지도" }]}
        />
      </View>
      {view === "feed" && (
        <View ref={storySpot} collapsable={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
          {me && (
            <MySlot
              me={people.get(me)!}
              count={mine.length}
              dimmed={!!only && only !== me}
              selected={only === me}
              onFace={() => {
                Haptics.selectionAsync();
                if (!mine.length) setPosting({ recordId: null });
                else setOnly((v) => (v === me ? null : me));
              }}
              onPlus={() => { Haptics.selectionAsync(); setPosting({ recordId: null }); }}
            />
          )}
          {row.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => { Haptics.selectionAsync(); setOnly((v) => (v === f.id ? null : f.id)); }}
              accessibilityLabel={`${f.nickname} 소식만 보기`}
              accessibilityState={{ selected: only === f.id }}
              style={{ alignItems: "center", gap: 5, opacity: only && only !== f.id ? 0.45 : 1 }}
            >
              <Avatar name={f.nickname} url={f.avatarUrl} size={48} ring={freshBy.has(f.id)} seed={f.id} />
              <Text numberOfLines={1} style={{ maxWidth: 56, fontFamily: F.sans, fontSize: 10.5, color: K.text2 }}>{f.nickname}</Text>
            </Pressable>
          ))}
        </ScrollView>
        </View>
      )}
    </View>
  );

  const sheets = (
    <>
      {wishSheet}
      <PostSheet
        visible={!!posting}
        startRecordId={posting?.recordId ?? null}
        onClose={() => setPosting(null)}
        onPosted={() => { setOnly(null); setView("feed"); requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true })); }}
        myPosts={mine}
      />
      <BottomSheetModal visible={!!menuFor} onClose={closeMenu}>
        {menuFor && (
          <View>
            <Text style={{ fontFamily: F.serif, fontSize: 17, color: C.ink }}>{menuStep === "report" ? "무엇이 문제인가요?" : menuFor.name}</Text>
            <View style={{ marginTop: 12 }}>
              {(menuFor.user_id === me
                ? [
                    { label: "사진 · 한 줄 고치기", onPress: () => { setPosting({ recordId: menuFor.record_id }); closeMenu(); } },
                    { label: "소식에서 내리기", onPress: () => takeDown(menuFor), danger: true },
                  ]
                : menuStep === "report"
                  ? REPORT_REASONS.map((reason) => ({ label: reason, onPress: () => reportPost(menuFor, reason), danger: false }))
                  : [
                      { label: "신고하기", onPress: () => setMenuStep("report"), danger: false },
                      { label: "차단하기", onPress: () => block(menuFor), danger: true },
                    ]
              ).map((o, i) => (
                <Pressable key={o.label} onPress={o.onPress} style={{ minHeight: 52, justifyContent: "center", borderTopWidth: i ? 1 : 0, borderTopColor: "#efeae0" }}>
                  <Text style={{ fontFamily: F.sans, fontSize: 14, color: o.danger ? C.brick : C.ink }}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </BottomSheetModal>
      {removed && (
        <View style={{ position: "absolute", left: 24, right: 24, bottom: TAB_BAR_H + insets.bottom + 16, borderRadius: 16, backgroundColor: C.ink, paddingVertical: 13, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: C.card }}>소식에서 내렸어요</Text>
          <Pressable onPress={undo} hitSlop={10}>
            <Text style={{ fontFamily: F.sans, fontSize: 12, color: "#e7b79f" }}>되돌리기</Text>
          </Pressable>
        </View>
      )}
    </>
  );

  if (view === "map") {
    return (
      <View style={{ flex: 1, backgroundColor: C.paper }}>
        <CommunityHeader right={right} />
        {head}
        <FriendMap
          posts={feed.filter((p) => p.user_id !== me)}
          people={people}
          onWish={addWish}
          onShowInFeed={(p) => { setOnly(p.user_id); setView("feed"); setScrollTo(p.id); }}
        />
        {sheets}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <CommunityHeader right={right} />
      <FlatListFeed
        listRef={listRef}
        posts={shown}
        people={people}
        me={me}
        header={head}
        empty={<Empty hasFriends={friends.length > 0} />}
        onComments={setCommentsFor}
        onMenu={setMenuFor}
        onWish={addWish}
        bottom={TAB_BAR_H + insets.bottom + 24}
      />
      <CommentsSheet recordId={commentsFor} onClose={() => setCommentsFor(null)} />
      {sheets}
    </View>
  );
}

/** 얼굴 줄 맨 앞 — 내 자리(48). 올린 게 없으면 벽돌 점선 고리, 있으면 먹색 2px. 오른쪽 아래 「+」는 늘 있습니다. */
function MySlot({ me, count, dimmed, selected, onFace, onPlus }: { me: Who; count: number; dimmed: boolean; selected: boolean; onFace: () => void; onPlus: () => void }) {
  const has = count > 0;
  return (
    <View style={{ alignItems: "center", gap: 5, opacity: dimmed ? 0.45 : 1 }}>
      <View style={{ width: 48, height: 48 }}>
        <Pressable onPress={onFace} accessibilityLabel={has ? "내 소식만 보기" : "소식 올리기"} accessibilityState={{ selected }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: has ? 2 : 1.5, borderStyle: has ? "solid" : "dashed", borderColor: has ? C.ink : C.brick, alignItems: "center", justifyContent: "center" }}>
            <Avatar name={me.nickname} url={me.avatarUrl} size={40} seed={me.id} />
          </View>
        </Pressable>
        <Pressable
          onPress={onPlus}
          hitSlop={10}
          accessibilityLabel="소식 올리기"
          style={{ position: "absolute", right: -2, bottom: -2, width: 19, height: 19, borderRadius: 10, borderWidth: 2, borderColor: C.paper, backgroundColor: C.brick, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ marginTop: -1, fontFamily: F.sansMd, fontSize: 12, lineHeight: 14, color: C.card }}>+</Text>
        </Pressable>
      </View>
      <Text numberOfLines={1} style={{ maxWidth: 60, fontFamily: F.sansMd, fontSize: 10.5, color: has ? C.ink : C.brick }}>{has ? `내 소식 ${count}` : "내 소식"}</Text>
    </View>
  );
}

function Empty({ hasFriends }: { hasFriends: boolean }) {
  const router = useRouter();
  return (
    <View style={{ paddingVertical: 44, paddingHorizontal: 28, alignItems: "center", gap: 14 }}>
      <Text style={{ textAlign: "center", fontFamily: F.sans, fontSize: 12.5, lineHeight: 21, color: C.faint }}>
        {hasFriends ? "친구가 아직 올린 소식이 없습니다." : "아직 친구가 없습니다.\n닉네임으로 찾거나 초대 링크를 보내 보세요."}
      </Text>
      {!hasFriends && (
        <Pressable onPress={() => router.push("/community/people")} style={{ minHeight: 40, borderRadius: 20, backgroundColor: C.ink, paddingHorizontal: 18, justifyContent: "center" }}>
          <Text style={{ fontFamily: F.sansMd, fontSize: 12.5, color: C.card }}>친구 찾기</Text>
        </Pressable>
      )}
    </View>
  );
}

function FlatListFeed({ listRef, posts, people, me, header, empty, onComments, onMenu, onWish, bottom }: {
  listRef: React.RefObject<FlatList<FriendPost> | null>;
  posts: FriendPost[]; people: Map<string, Who>; me: string | null;
  header: React.ReactElement; empty: React.ReactElement; onComments: (recordId: number) => void; onMenu: (p: FriendPost) => void; onWish: OnWish; bottom: number;
}) {
  const { data: social } = useRecordSocial(posts.map((p) => p.record_id));
  return (
    <FlatList
      ref={listRef}
      data={posts}
      keyExtractor={(p) => String(p.id)}
      ListHeaderComponent={<View style={{ marginBottom: 14 }}>{header}</View>}
      ListEmptyComponent={empty}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      contentContainerStyle={{ paddingBottom: bottom }}
      onScrollToIndexFailed={(e) => listRef.current?.scrollToOffset({ offset: e.averageItemLength * e.index, animated: true })}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: 16 }}>
          <FeedCard
            p={item}
            who={people.get(item.user_id)}
            mine={item.user_id === me}
            social={social?.get(item.record_id)}
            onComments={() => onComments(item.record_id)}
            onMenu={() => onMenu(item)}
            onWish={onWish}
          />
        </View>
      )}
    />
  );
}

/** 고른 사진을 옆으로 넘깁니다. 2장 이상이면 아래 가운데 6px 점. */
function PhotoPager({ urls, height }: { urls: string[]; height: number }) {
  const [w, setW] = useState(0);
  const [page, setPage] = useState(0);
  if (urls.length <= 1) return <PhotoOrStripes uri={urls[0]} height={height} radius={14} label="인증 사진" />;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => w && setPage(Math.round(e.nativeEvent.contentOffset.x / w));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height, borderRadius: 14, overflow: "hidden", backgroundColor: K.stripe }}>
      {w > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} nestedScrollEnabled>
          {urls.map((u, i) => <SignedImage key={u + i} uri={u} style={{ width: w, height }} resizeMode="cover" />)}
        </ScrollView>
      )}
      <View pointerEvents="none" style={{ position: "absolute", bottom: 9, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 }}>
        {urls.map((_, i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.card, opacity: i === page ? 1 : 0.55 }} />)}
      </View>
    </View>
  );
}

/** 소식 카드 — 고른 사진 · 한 줄. 내 카드는 먹색 테두리 + 받는 사람 칩 + ··· 메뉴, 위시 버튼 없음. */
const FeedCard = memo(function FeedCard({ p, who, mine, social, onComments, onMenu, onWish }: {
  p: FriendPost; who?: Who; mine: boolean; social?: { cheers: number; mine: boolean; comments: number }; onComments: () => void; onMenu: () => void; onWish: OnWish;
}) {
  const qc = useQueryClient();
  const [wish, setWish] = useState<"idle" | "added" | "exists">("idle");
  const name = who?.nickname ?? "";
  const meta = metaLine(p.category, shortAddr(p.address, p.region));

  async function addWish() {
    try {
      const res = await onWish({ name: p.name, where_text: p.address ?? p.region, category: p.category, lat: p.lat, lng: p.lng, source: `${name}의 소식` });
      if (res) setWish(res);
    } catch {
      setWish("idle");
    }
  }
  const wishLabel = wish === "added" ? "✓ 위시에 담음" : wish === "exists" ? "이미 담아둔 곳" : "+ 위시에 담기";

  return (
    <View style={{ borderRadius: 20, borderWidth: 1, borderColor: mine ? C.ink : C.lineSoft, backgroundColor: C.card, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <Avatar name={name} url={who?.avatarUrl} size={30} seed={p.user_id} />
        <Text style={{ fontFamily: F.sansMd, fontSize: 13, color: C.ink }}>{mine ? "내 소식" : name}</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 10, color: K.inactive }}>{timeAgo(p.created_at)}</Text>
        <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6 }}>
          {!mine && <VerifiedChip />}
          {/* 내 소식: 고치기 · 내리기 / 남의 소식: 신고 · 차단 */}
          <Pressable onPress={onMenu} hitSlop={8} accessibilityLabel="소식 메뉴"
            style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ marginTop: -6, fontFamily: F.sansMd, fontSize: 14, color: K.text2 }}>···</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ marginTop: 12 }}><PhotoPager urls={postPhotos(p)} height={170} /></View>
      <View style={{ marginTop: 12, flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={{ flexShrink: 1, fontFamily: F.serif, fontSize: 16, color: C.ink }}>{p.name}</Text>
        {p.rating != null && <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.brick }}>★ {p.rating}</Text>}
      </View>
      {!!meta && <Text style={{ marginTop: 3, fontFamily: F.sans, fontSize: 11, color: C.faint }}>{meta}</Text>}
      {!!p.note && <Text style={{ marginTop: 8, fontFamily: F.serif, fontSize: 12.5, lineHeight: 21, color: K.text2 }}>{p.note}</Text>}
      <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 14 }}>
        <LikeButton on={!!social?.mine} count={social?.cheers ?? 0} onPress={mine ? undefined : () => toggleCheer(qc, p.record_id, !social?.mine)} />
        <Pressable onPress={onComments} hitSlop={8}>
          <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.muted }}>댓글 {social?.comments ?? 0}</Text>
        </Pressable>
        {!mine && (
          <Pressable
            onPress={addWish}
            disabled={wish !== "idle"}
            style={{ marginLeft: "auto", minHeight: 30, borderRadius: 15, borderWidth: 1, borderColor: K.brickLine, paddingHorizontal: 11, justifyContent: "center", backgroundColor: wish === "idle" ? "transparent" : C.brickSoft }}
          >
            <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.brick }}>{wishLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

/* ───────────── 친구 지도(시안 2a) ───────────── */

type Spot = { place: string; name: string; lat: number; lng: number; posts: FriendPost[]; latest: string; inWish: boolean };
type MapFilter = "all" | "week" | "nowish";

const DAY = 86400000;
const STALE_DAYS = 30;
/** 이 줌부터 핀 위에 이름표를 붙입니다. */
const LABEL_ZOOM = 14;

/** 위시에 이미 있는지 — 이름이 같거나 좌표가 60m 안. */
function wishHas(wishes: Wish[], name: string, lat: number, lng: number) {
  if (matchWish(wishes, name)) return true;
  return wishes.some((w) => w.lat != null && w.lng != null && metersBetween({ lat, lng }, w.lat, w.lng) <= 60);
}

/** 친구가 소식에 올린 가게만 한 지도에 — 핀은 올린 사람 얼굴. */
function FriendMap({ posts, people, onWish, onShowInFeed }: { posts: FriendPost[]; people: Map<string, Who>; onWish: OnWish; onShowInFeed: (p: FriendPost) => void }) {
  const insets = useSafeAreaInsets();
  const { data: wishes = [] } = useWishes();
  const [filter, setFilter] = useState<MapFilter>("all");
  const [picked, setPicked] = useState<string | null>(null);
  const [wish, setWish] = useState<"idle" | "added" | "exists">("idle");
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  // 확대 · 축소에 따라 핀 크기를 바꾸고, 충분히 확대하면 이름표(올린 사람 · 때)를 붙입니다.
  const [zoom, setZoom] = useState(12.5);

  // 위치 권한이 이미 있을 때만 거리를 붙입니다(여기서 권한을 묻지 않음).
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(async (p) => {
      if (!p.granted) return;
      const pos = await Location.getLastKnownPositionAsync();
      if (pos) setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }).catch(() => {});
  }, []);

  const spots = useMemo(() => {
    const m = new Map<string, Spot>();
    for (const p of posts) {
      if (p.lat == null || p.lng == null) continue;
      const s = m.get(p.place);
      if (s) {
        // 한 사람은 한 번만(가장 최근 것)
        if (!s.posts.some((x) => x.user_id === p.user_id)) s.posts.push(p);
      } else {
        m.set(p.place, { place: p.place, name: p.name, lat: p.lat, lng: p.lng, posts: [p], latest: p.created_at, inWish: false });
      }
    }
    for (const s of m.values()) {
      s.posts.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
      s.latest = s.posts[0].created_at;
      s.inWish = wishHas(wishes, s.name, s.lat, s.lng);
    }
    return [...m.values()];
  }, [posts, wishes]);

  const visible = spots.filter((s) =>
    filter === "week" ? Date.now() - Date.parse(s.latest) <= 7 * DAY : filter === "nowish" ? !s.inWish : true,
  );
  const spot = spots.find((s) => s.place === picked) ?? null;
  const center = spots[0] ?? { lat: 37.5605, lng: 126.982 };
  const nameOf = (id: string) => people.get(id)?.nickname ?? "친구";

  async function addWish(s: Spot) {
    const top = s.posts[0];
    try {
      const res = await onWish({ name: s.name, where_text: top.address ?? top.region, category: top.category, lat: s.lat, lng: s.lng, source: `${nameOf(top.user_id)}의 소식` });
      if (res) setWish(res);
    } catch {
      setWish("idle");
    }
  }

  return (
    <View style={{ flex: 1, marginTop: 14, overflow: "hidden" }}>
      <PaperMap
        initialCamera={{ latitude: center.lat, longitude: center.lng, zoom: spots.length ? 12.5 : 11 }}
        mapPadding={{ top: 0, bottom: TAB_BAR_H + insets.bottom, left: 20, right: 20 }}
        onTapMap={() => setPicked(null)}
        onCameraIdle={(e) => { if (e.zoom != null) setZoom(e.zoom); }}
      >
        {visible.map((s) => {
          const n = s.posts.length;
          const top = nameOf(s.posts[0].user_id);
          const stale = Date.now() - Date.parse(s.latest) > STALE_DAYS * DAY;
          return (
            <FriendMarker
              key={s.place}
              lat={s.lat}
              lng={s.lng}
              letter={(top || "?").slice(0, 1)}
              count={n}
              size={friendPinSize(zoom) - (stale ? 4 : 0)}
              stale={stale}
              inWish={s.inWish}
              showLabel={zoom >= LABEL_ZOOM || picked === s.place}
              label={n > 1 ? `${top} 외 ${n - 1}` : top}
              time={timeAgo(s.latest)}
              zIndex={picked === s.place ? 1000 : n}
              onTap={() => { Haptics.selectionAsync(); setWish(s.inWish ? "exists" : "idle"); setPicked(s.place); }}
            />
          );
        })}
      </PaperMap>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ position: "absolute", top: 12, left: 0, right: 0, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
        {([["all", "전체"], ["week", "이번 주"], ["nowish", "위시에 없는 곳"]] as const).map(([id, label]) => {
          const on = filter === id;
          return (
            <Pressable key={id} onPress={() => { Haptics.selectionAsync(); setFilter(id); }} accessibilityState={{ selected: on }}
              style={[{ height: 32, borderRadius: 16, paddingHorizontal: 13, justifyContent: "center", backgroundColor: on ? C.ink : C.card, borderWidth: on ? 0 : 1, borderColor: C.line }, SHADOW.card]}>
              <Text style={{ fontFamily: on ? F.sansMd : F.sans, fontSize: 12, color: on ? C.card : K.text2 }}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {spots.length === 0 && (
        <View pointerEvents="none" style={{ position: "absolute", top: 56, left: 20, right: 20, borderRadius: 16, backgroundColor: "rgba(251,250,246,.95)", padding: 12 }}>
          <Text style={{ textAlign: "center", fontFamily: F.sans, fontSize: 12, color: C.faint }}>친구가 소식에 올린 가게가 아직 없습니다.</Text>
        </View>
      )}

      {spot && (
        <View style={[{ position: "absolute", left: 16, right: 16, bottom: TAB_BAR_H + insets.bottom + 14, borderRadius: 22, borderWidth: 1, borderColor: C.lineSoft, backgroundColor: C.card, padding: 16 }, SHADOW.card]}>
          <Text style={{ fontFamily: F.serif, fontSize: 18, color: C.ink }}>{spot.name}</Text>
          <Text style={{ marginTop: 3, fontFamily: F.sans, fontSize: 11, color: C.faint }}>
            {metaLine(spot.posts[0].category, shortAddr(spot.posts[0].address, spot.posts[0].region), here ? formatDistance(metersBetween(here, spot.lat, spot.lng)) : null)}
          </Text>
          <Text style={{ marginTop: 3, fontFamily: F.sans, fontSize: 11.5, color: C.brick }}>친구 {spot.posts.length}명이 소식에 올림</Text>

          <View style={{ marginTop: 10, gap: 10 }}>
            {spot.posts.slice(0, 2).map((p) => {
              const who = people.get(p.user_id);
              return (
                <View key={p.id} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                  <Avatar name={who?.nickname ?? ""} url={who?.avatarUrl} size={28} seed={p.user_id} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={{ fontFamily: F.sansMd, fontSize: 12, color: C.ink }}>{who?.nickname ?? ""}</Text>
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: K.inactive }}>{timeAgo(p.created_at)}</Text>
                      {!!p.verified_at && <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.brick }}>✓ 인증 {monthDay(p.verified_at)}</Text>}
                    </View>
                    {!!p.note && <Text numberOfLines={2} style={{ marginTop: 2, fontFamily: F.serif, fontSize: 12.5, lineHeight: 19, color: K.text2 }}>{p.note}</Text>}
                  </View>
                  <PhotoOrStripes uri={postPhotos(p)[0]} height={44} width={44} radius={10} />
                </View>
              );
            })}
            {spot.posts.slice(2).map((p) => (
              <Text key={p.id} style={{ fontFamily: F.sans, fontSize: 11.5, color: C.muted }}>+ {nameOf(p.user_id)} · {monthDay(p.created_at)}</Text>
            ))}
          </View>

          <View style={{ marginTop: 14, flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => onShowInFeed(spot.posts[0])}
              style={{ flex: 1, height: 44, borderRadius: 16, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.ink }}>소식에서 보기</Text>
            </Pressable>
            <Pressable onPress={() => addWish(spot)} disabled={wish !== "idle"}
              style={{ flex: 1, height: 44, borderRadius: 16, backgroundColor: wish === "idle" ? C.ink : C.brickSoft, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }}>
              {wish === "idle" && <BookmarkIcon size={14} stroke={C.card} />}
              <Text style={{ fontFamily: F.sansMd, fontSize: 13, color: wish === "idle" ? C.card : C.brick }}>
                {wish === "added" ? "✓ 위시에 담음" : wish === "exists" ? "이미 담아둔 곳" : "위시에 담기"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
