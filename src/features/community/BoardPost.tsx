import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { showDialog } from "@/components/Dialog";
import { Text } from "@/components/Text";
import { useAccount } from "@/data/profile";
import { regionFromAddress } from "@/lib/regions";
import { coverPhoto } from "@/lib/types";
import { C, F, FAINT_BOLD } from "@/theme";
import { setReaction, usePoll, votePoll, type BoardPost, type CourseStop, type PostType } from "./api";
import { CourseMap } from "./CourseMap";
import { MoreButton, type MenuTarget } from "./ItemMenu";
import { useOpenProfile } from "./ProfileSheet";
import { useAddWish } from "./useAddWish";
import { Avatar, K, LikeButton, metaLine, monthDay, PhotoOrStripes, shortAddr, timeAgo, TitleChip } from "./ui";

/** 게시판 다섯 칸 이름. */
export const BOARD_LABEL: Record<PostType, string> = { free: "자유", theme: "주제", food: "맛집", cafe: "카페", course: "코스" };
/** 전체 칸에서 글마다 붙는 알약 — 투표 글은 「자유 · 투표」. */
export const boardPill = (p: Pick<BoardPost, "type" | "poll_closes_at">) => (p.type === "free" && p.poll_closes_at ? "자유 · 투표" : BOARD_LABEL[p.type]);

/** "서울 성동구" → "성동구" */
export const guLabel = (gu: string) => gu.split(" ").pop() ?? gu;
export const guOf = (address: string | null | undefined) => regionFromAddress(address) || null;

/** 기록 글이 아닌데 제목이 없는 옛 글(주제 답 · 기록 나눔)은 가게 이름을 제목으로. */
export const postTitle = (p: Pick<BoardPost, "title" | "place_name">) => p.title || p.place_name || "";

/** 관리자 글 · 댓글은 「DINARY 운영」 + 검정 원 D. */
export const StaffAvatar = ({ size }: { size: number }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
    <Text style={{ fontFamily: F.serif, fontSize: Math.round(size * 0.45), color: C.card }}>D</Text>
  </View>
);

/** 게시판 알약 — 「맛집」 · 「자유 · 투표」 … */
export const BoardPill = ({ label }: { label: string }) => (
  <Text style={{ borderRadius: 6, backgroundColor: K.segMap, paddingHorizontal: 7, paddingVertical: 1, fontFamily: F.mono, fontSize: 10, color: C.muted, overflow: "hidden" }}>{label}</Text>
);

/** 글쓴이 줄 — (게시판 알약) · 얼굴 · 이름 · 칭호 · 때 · ⋯. 얼굴 · 이름을 누르면 프로필 창. */
export function AuthorRow({
  userId, name, url, titleId, role, size = 24, pill, time, badge, more,
}: {
  userId: string; name: string | null; url: string | null; titleId: string | null; role?: "user" | "admin";
  size?: number; pill?: string; time?: string; badge?: React.ReactNode; more?: React.ReactNode;
}) {
  const openProfile = useOpenProfile();
  const staff = role === "admin";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      {!!pill && <BoardPill label={pill} />}
      <Pressable onPress={() => openProfile(userId)} hitSlop={4} accessibilityLabel={`${staff ? "DINARY 운영" : name ?? ""} 프로필`} style={{ flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 }}>
        {staff ? <StaffAvatar size={size} /> : <Avatar name={name ?? ""} url={url} size={size} seed={userId} />}
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.sansMd, fontSize: size < 24 ? 11.5 : 12, color: C.ink }}>{staff ? "DINARY 운영" : name}</Text>
      </Pressable>
      {!staff && <TitleChip id={titleId} />}
      {badge}
      {!!time && <Text style={{ fontFamily: F.mono, fontSize: 10, color: K.inactive }}>{time}</Text>}
      <View style={{ flex: 1 }} />
      {more}
    </View>
  );
}

/** 붙인 기록 한 장 — 사진 · 가게 · 별점 · (인증이면) MM.DD 인증. */
export function RecordMini({
  name, photo, rating, category, address, verifiedAt, size = 56, right,
}: { name: string | null; photo: string | null; rating?: number | null; category?: string | null; address?: string | null; verifiedAt?: string | null; size?: number; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <PhotoOrStripes uri={photo} width={size} height={size} radius={size > 40 ? 12 : 8} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 7 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.serif, fontSize: size > 40 ? 15 : 12.5, color: C.ink }}>{name}</Text>
          {rating != null && <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.brick }}>★ {rating}</Text>}
        </View>
        {size > 40 && !!(category || address) && <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 11, color: C.faint }}>{metaLine(category, shortAddr(address ?? null, null))}</Text>}
        {!!verifiedAt && <Text style={{ fontFamily: F.mono, fontSize: size > 40 ? 10 : 9.5, color: C.brick }}>{size > 40 ? `${monthDay(verifiedAt)} ` : ""}인증</Text>}
      </View>
      {right}
    </View>
  );
}

const postPhoto = (p: BoardPost) => coverPhoto({ photo_urls: p.photo_urls ?? [], cover_index: p.cover_index ?? 0, photo_url: p.photo_url });
const stopPhoto = (s: CourseStop) => coverPhoto({ photo_urls: s.photo_urls ?? [], cover_index: s.cover_index ?? 0, photo_url: s.photo_url });

/* ───────────── 코스 ───────────── */

/**
 * 코스 — (요약 자리) · 동선 지도 · 번호 원 세로 줄 + 메모.
 * 네이버 지도에 번호 핀 + 가게 이름. 상세(onMapTouch 가 있으면)는 끌고 확대할 수 있고 가게 줄을 누르면 기록 상세, 목록 카드는 만질 수 없게(누르면 글 열기).
 */
export function CourseBlock({ stops, onMapTouch }: { stops: CourseStop[]; onMapTouch?: (touching: boolean) => void }) {
  const router = useRouter();
  return (
    <View style={{ gap: 10 }}>
      {/* TODO(코스 요약): 시안의 「도보 12분 · 저녁 · 2인 약 6만 원」 자리 — 이번에는 비워 둡니다. */}
      {onMapTouch ? <CourseMap stops={stops} onTouch={onMapTouch} /> : <CourseMap stops={stops} interactive={false} />}
      <View>
        {stops.map((s, i) => (
          <View key={s.position} style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ alignItems: "center", width: 22 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.brick, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.card }}>{s.position}</Text>
              </View>
              {i < stops.length - 1 && <View style={{ flex: 1, width: 1.5, backgroundColor: K.brickLine, marginVertical: 2 }} />}
            </View>
            <Pressable
              disabled={!onMapTouch}
              onPress={() => router.push({ pathname: "/community/board/record/[id]", params: { id: String(s.record_id) } })}
              accessibilityLabel={`${s.name} 기록 자세히 보기`}
              style={{ flex: 1, minWidth: 0, paddingBottom: i < stops.length - 1 ? 12 : 0, gap: 2 }}
            >
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.serif, fontSize: 14, color: C.ink }}>{s.name}</Text>
                <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.sans, fontSize: 10.5, color: C.faint }}>{s.category}</Text>
                {!!onMapTouch && <Text style={{ marginLeft: "auto", fontFamily: F.sans, fontSize: 15, color: C.faint }}>›</Text>}
              </View>
              {!!s.memo && <Text style={{ fontFamily: F.sans, fontSize: 12, lineHeight: 18, color: K.text2 }}>{s.memo}</Text>}
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ───────────── 투표 ───────────── */

/** 선택지 — 투표 전에는 단추, 투표했거나 마감이면 막대 · % (내 선택은 ✓ + 벽돌 테두리). 결과를 보고도 다시 눌러 바꿀 수 있습니다. */
export function PollOptions({ post }: { post: BoardPost }) {
  const qc = useQueryClient();
  const { data: options = [] } = usePoll(post.id);
  const [busy, setBusy] = useState(false);
  const closed = !!post.poll_closes_at && Date.parse(post.poll_closes_at) <= Date.now();
  const shown = options.some((o) => o.count != null);
  const total = options.reduce((n, o) => n + (o.count ?? 0), 0);

  async function vote(id: number) {
    if (busy || closed) return;
    setBusy(true);
    Haptics.selectionAsync();
    try { await votePoll(qc, post.id, id); } catch (e) { showDialog("투표하지 못했습니다", e instanceof Error ? e.message : ""); }
    setBusy(false);
  }

  return (
    <View style={{ gap: 6 }}>
      {options.map((o) => {
        const pct = shown && total ? Math.round(((o.count ?? 0) / total) * 100) : 0;
        return (
          <Pressable
            key={o.option_id}
            onPress={() => vote(o.option_id)}
            disabled={busy || closed || o.mine}
            accessibilityState={{ selected: o.mine }}
            style={{ minHeight: 40, borderRadius: 12, borderWidth: o.mine ? 1.5 : 1, borderColor: o.mine ? C.brick : C.line, backgroundColor: C.card, overflow: "hidden", justifyContent: "center" }}
          >
            {shown && <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: o.mine ? C.brickSoft : K.segMap }} />}
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 13, gap: 6 }}>
              {o.mine && <Text style={{ fontFamily: F.sansBd, fontSize: 12, color: C.brick }}>✓</Text>}
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: o.mine ? F.sansMd : F.sans, fontSize: 12.5, color: C.ink }}>{o.label}</Text>
              {shown && <Text style={{ fontFamily: F.mono, fontSize: 11, color: o.mine ? C.brick : C.muted }}>{pct}%</Text>}
            </View>
          </Pressable>
        );
      })}
      <Text style={{ fontFamily: F.mono, fontSize: 10, color: K.inactive }}>
        {post.poll_total}명 투표 · {closed ? "마감됨" : `${pollLeft(post.poll_closes_at!)} 남음`}{!shown && !closed ? " · 투표하면 결과가 보입니다" : ""}
      </Text>
    </View>
  );
}

const pollLeft = (iso: string) => {
  const h = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 3600000));
  return h >= 24 ? `${Math.round(h / 24)}일` : `${Math.max(h, 1)}시간`;
};

/** 목록의 빠른 투표 — ♡ · 「N명 투표 · 댓글 N」 + 「투표 열기 / 결과 보기」. 누르면 그 자리에서 펼칩니다. */
function QuickPoll({ post }: { post: BoardPost }) {
  const [open, setOpen] = useState(false);
  const closed = !!post.poll_closes_at && Date.parse(post.poll_closes_at) <= Date.now();
  const voted = post.my_vote != null || closed;
  return (
    <View style={{ gap: 8 }}>
      {open && <PollOptions post={post} />}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Reactions post={post} />
        <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 11.5, color: C.muted }}>{post.poll_total}명 투표 · 댓글 {post.comment_count}</Text>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); setOpen((v) => !v); }}
          hitSlop={6}
          style={{ minHeight: 28, borderRadius: 14, borderWidth: 1, borderColor: C.brick, paddingHorizontal: 12, justifyContent: "center", backgroundColor: open ? C.brickSoft : "transparent" }}
        >
          <Text style={{ fontFamily: F.sansMd, fontSize: 11, color: C.brick }}>{open ? "접기" : voted ? "결과 보기" : "투표 열기"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ───────────── 반응 ───────────── */

/**
 * 모든 글: ♡ 좋아요(cheer 반응, 내 글은 수만) / 맛집 · 카페: + 「+ 위시에 담기」 / 코스: + 「+ 코스 담기」.
 */
export function Reactions({ post, stops }: { post: BoardPost; stops?: CourseStop[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { add, addMany, sheet } = useAddWish();
  const { data: account } = useAccount();
  const mine = account?.userId === post.author_id;
  const source = `${post.author_role === "admin" ? "DINARY 운영" : post.nickname ?? "게시판"}의 ${post.type === "course" ? "코스" : "기록"}`;

  async function toggle(kind: "want" | "been" | "cheer", on: boolean, after?: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    if (kind !== "cheer") Haptics.selectionAsync();
    try {
      if (on && after) {
        const res = await after();
        if (res === null) { setBusy(false); return; } // 위시리스트 고르기를 닫음
      }
      await setReaction(qc, post.id, kind, on);
    } catch (e) { showDialog("잠시 뒤 다시 해 주세요", e instanceof Error ? e.message : ""); }
    setBusy(false);
  }

  const chip = (label: string, on: boolean, onPress: () => void, brick = true) => (
    <Pressable onPress={onPress} disabled={busy} style={{ minHeight: 28, borderRadius: 14, borderWidth: 1, borderColor: brick ? K.brickLine : on ? C.ink : C.lineSoft, paddingHorizontal: 10, justifyContent: "center", backgroundColor: on && brick ? C.brickSoft : "transparent" }}>
      <Text style={{ fontFamily: on ? F.sansMd : F.sans, fontSize: 11, color: brick ? C.brick : on ? C.ink : C.muted }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <LikeButton on={post.my_cheer} count={post.cheer_count} disabled={busy} onPress={mine ? undefined : () => toggle("cheer", !post.my_cheer)} />
      {(post.type === "food" || post.type === "cafe") && chip(post.my_want ? "✓ 위시에 담음" : "+ 위시에 담기", post.my_want, () =>
        toggle("want", !post.my_want, post.place_name
          ? () => add({ name: post.place_name!, where_text: post.address, category: post.category, lat: post.lat, lng: post.lng, source })
          : undefined))}
      {post.type === "course" && chip(post.my_want ? "✓ 코스 담음" : "+ 코스 담기", post.my_want, () =>
        toggle("want", !post.my_want, stops?.length
          ? () => addMany(stops.map((s) => ({ name: s.name, where_text: s.address, category: s.category, lat: s.lat, lng: s.lng, source })))
          : undefined))}
      {sheet}
    </View>
  );
}

/* ───────────── 목록 카드 ───────────── */

/** 공지 한 줄 — 벽돌 「공지」 알약 + 제목 + 「DINARY 운영」. */
export function NoticeRow({ post, onOpen }: { post: BoardPost; onOpen: () => void }) {
  return (
    <Pressable onPress={onOpen} style={{ marginHorizontal: 16, marginTop: 10, minHeight: 44, borderRadius: 12, backgroundColor: K.segMap, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ borderRadius: 8, backgroundColor: C.brick, paddingHorizontal: 7, paddingVertical: 1, fontFamily: F.sansBd, fontSize: 10.5, color: C.card, overflow: "hidden" }}>공지</Text>
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.sansMd, fontSize: 12.5, color: C.ink }}>{postTitle(post)}</Text>
      <Text style={{ fontFamily: F.mono, fontSize: 9.5, color: C.faint }}>DINARY 운영</Text>
    </Pressable>
  );
}

export const Tags = ({ tags, onTag }: { tags: string[]; onTag?: (t: string) => void }) =>
  tags.length ? (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {tags.map((t) => (
        <Pressable key={t} onPress={onTag ? () => onTag(t) : undefined} disabled={!onTag} hitSlop={4}>
          <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.brick }}>#{t}</Text>
        </Pressable>
      ))}
    </View>
  ) : null;

/** 게시판 목록 글 하나 — 작성자 줄 · 제목 · 본문 2줄 · 태그 · (칸마다) 기록 / 코스 / 빠른 투표 · 반응 · 댓글 수. */
/**
 * 앨범에서 붙인 사진 — 목록(compact)은 한 장이면 넓게, 여러 장이면 세 칸까지 나란히(넘치면 「+n」).
 * 상세는 한 장씩 넓게 아래로.
 */
export function PostPhotos({ refs, compact }: { refs: string[] | null | undefined; compact?: boolean }) {
  const list = refs ?? [];
  if (!list.length) return null;
  if (!compact) {
    return (
      <View style={{ gap: 8 }}>
        {list.map((r) => <PhotoOrStripes key={r} uri={r} height={260} radius={16} />)}
      </View>
    );
  }
  if (list.length === 1) return <PhotoOrStripes uri={list[0]} height={180} radius={14} />;
  const shown = list.slice(0, 3);
  const more = list.length - shown.length;
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {shown.map((r, i) => (
        <View key={r} style={{ flex: 1 }}>
          <PhotoOrStripes uri={r} height={108} radius={12} />
          {more > 0 && i === shown.length - 1 && (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, backgroundColor: "rgba(28,26,23,0.42)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: F.sansMd, fontSize: 15, color: C.card }}>+{more}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

export function PostCard({
  post, stops, showBoard, onOpen, onTag, onEdit,
}: { post: BoardPost; stops?: CourseStop[]; showBoard?: boolean; onOpen: () => void; onTag?: (t: string) => void; onEdit?: () => void }) {
  const target: MenuTarget = { kind: "post", post };
  const hasRecord = !!post.place_name && post.type !== "course";
  const hasPoll = post.type === "free" && !!post.poll_closes_at;
  return (
    <View style={{ gap: 9 }}>
      <AuthorRow
        userId={post.author_id} name={post.nickname} url={post.avatar_url} titleId={post.title_label_id} role={post.author_role}
        pill={showBoard ? boardPill(post) : undefined} time={timeAgo(post.created_at)}
        more={<MoreButton target={target} onEdit={onEdit} />}
      />
      <Pressable onPress={onOpen} style={{ gap: 6 }}>
        {!!postTitle(post) && <Text numberOfLines={2} style={[{ fontFamily: F.serif, fontSize: 15.5, lineHeight: 22, color: C.ink }, FAINT_BOLD]}>{postTitle(post)}</Text>}
        {!!post.body && <Text numberOfLines={2} style={{ fontFamily: F.sans, fontSize: 12.5, lineHeight: 19, color: K.text2 }}>{post.body}</Text>}
      </Pressable>
      {!!post.photo_refs?.length && <Pressable onPress={onOpen}><PostPhotos refs={post.photo_refs} compact /></Pressable>}
      <Tags tags={post.tags} onTag={onTag} />
      {hasRecord && (
        <Pressable onPress={onOpen}>
          <RecordMini name={post.place_name} photo={postPhoto(post)} rating={post.rating} category={post.category} address={post.address} verifiedAt={post.verified ? post.verified_at : null} />
        </Pressable>
      )}
      {post.type === "course" && stops && <Pressable onPress={onOpen}><CourseBlock stops={stops} /></Pressable>}
      {hasPoll ? (
        <QuickPoll post={post} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}><Reactions post={post} stops={stops} /></View>
          <Pressable onPress={onOpen} hitSlop={6}>
            <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.muted }}>댓글 {post.comment_count}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export { postPhoto, stopPhoto };
