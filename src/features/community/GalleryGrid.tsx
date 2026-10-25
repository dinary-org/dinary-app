import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, useWindowDimensions, View } from "react-native";
import { Text } from "@/components/Text";
import { HeartIcon } from "@/components/icons";
import { SignedImage } from "@/lib/signedPhoto";
import { C, F } from "@/theme";
import { setGalleryLike, type GalleryPhoto } from "./api";

const GAP = 3;

/**
 * 갤러리 3칸 격자(HANDOFF-gallery 01) — 사진만, 칸 사이 3px, 정사각.
 * 처음 누르면 그 칸에 정보(가게 · 메뉴 · ♡ · 댓글 · 보기 ›), 같은 칸을 한 번 더 누르면 정보를 닫고 사진만 — 자세히는 「보기 ›」로.
 * 정보의 ♡ 를 누르면 들어가지 않고 바로 좋아요(누른 것만 채운 하트).
 * 다른 칸을 누르면 정보가 그 칸으로 옮겨 가고(한 번에 한 칸), 스크롤하면 닫힙니다.
 */
export function GalleryGrid({
  photos, header, footer, empty, refreshing, onRefresh,
}: {
  photos: GalleryPhoto[];
  header?: React.ReactElement;
  footer?: React.ReactElement;
  empty?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const size = Math.floor((width - GAP * 2) / 3);
  const [picked, setPicked] = useState<number | null>(null);
  const open = (id: number) => router.push({ pathname: "/community/gallery/[id]", params: { id: String(id) } });
  const qc = useQueryClient();
  // 누르자마자 바뀌게 — 서버 목록이 다시 올 때까지 이 칸의 좋아요 · 수를 덮어씁니다.
  const [likes, setLikes] = useState<Record<number, { on: boolean; n: number }>>({});
  const likeOf = (p: GalleryPhoto) => likes[p.id] ?? { on: p.my_like, n: p.like_count };

  async function toggleLike(p: GalleryPhoto) {
    const cur = likeOf(p);
    const next = { on: !cur.on, n: cur.n + (cur.on ? -1 : 1) };
    Haptics.selectionAsync();
    setLikes((m) => ({ ...m, [p.id]: next }));
    try {
      await setGalleryLike(qc, p.id, next.on);
    } catch {
      setLikes((m) => ({ ...m, [p.id]: cur }));
    }
  }

  return (
    <FlatList
      data={photos}
      keyExtractor={(p) => String(p.id)}
      numColumns={3}
      columnWrapperStyle={{ gap: GAP }}
      contentContainerStyle={{ gap: GAP, paddingBottom: 96 }}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      onScrollBeginDrag={() => setPicked(null)}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={<Text style={{ paddingVertical: 44, textAlign: "center", fontFamily: F.sans, fontSize: 12.5, color: C.faint }}>{empty ?? "아직 올라온 사진이 없습니다."}</Text>}
      renderItem={({ item: p }) => {
        const on = picked === p.id;
        const like = likeOf(p);
        return (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setPicked(on ? null : p.id);
            }}
            accessibilityLabel={`${p.place_name}${p.menu ? ` · ${p.menu}` : ""}`}
            accessibilityHint={on ? "한 번 더 누르면 정보를 닫습니다" : "누르면 가게 · 메뉴가 보입니다"}
            style={{ width: size, height: size, backgroundColor: "#ece7dc" }}
          >
            <SignedImage uri={p.photo_ref} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            {on && (
              <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(28,26,23,.62)", justifyContent: "flex-end", padding: 8, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontFamily: F.serif, fontSize: 13, color: C.card }}>{p.place_name}</Text>
                {!!p.menu && <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 10.5, color: "#e8e2d6" }}>{p.menu}</Text>}
                <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center" }}>
                  <Pressable
                    onPress={() => toggleLike(p)}
                    hitSlop={10}
                    accessibilityLabel={like.on ? "좋아요 취소" : "좋아요"}
                    accessibilityState={{ selected: like.on }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                  >
                    <HeartIcon size={12} stroke={like.on ? C.brick : "#d8d2c6"} fill={like.on ? C.brick : "none"} strokeWidth={2} />
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: like.on ? C.card : "#d8d2c6" }}>{like.n}</Text>
                  </Pressable>
                  <Text style={{ flex: 1, fontFamily: F.mono, fontSize: 9, color: "#d8d2c6" }}> · 댓글 {p.comment_count}</Text>
                  <Pressable onPress={() => open(p.id)} hitSlop={8}>
                    <Text style={{ fontFamily: F.sansMd, fontSize: 10, color: C.card }}>보기 ›</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        );
      }}
    />
  );
}
