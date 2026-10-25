import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Dimensions, Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThumbIcon, VerifiedMark } from "@/components/icons";
import { BackButton, Eyebrow, MobileStars, PhotoBox, Pigs } from "@/components/ui";
import { useBoardRecord } from "@/features/community/api";
import { photosOf } from "@/lib/record";
import { SignedImage } from "@/lib/signedPhoto";
import { dottedDate, verifiedDateTime } from "@/lib/types";
import { C, F, FAINT_BOLD } from "@/theme";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Eyebrow>{label}</Eyebrow>
      <View style={{ marginTop: 7 }}>{children}</View>
    </View>
  );
}

/**
 * 게시판 글 · 코스 · 댓글에 붙인 기록 상세 — 내 기록 상세(record/[id])와 같은 모양으로 사진 · 별점 · 돼지 · 방문 · 메뉴 · 주소 · 키워드.
 * 쓴 사람의 메모(review)는 서버(board_record_detail)에서부터 오지 않고, 고치기 · 지우기 단추도 없습니다.
 */
export default function BoardRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: record, isLoading } = useBoardRecord(Number(id));
  const [shown, setShown] = useState<number | null>(null);

  if (!record) {
    return (
      <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: insets.top }}>
        <BackButton />
        <Text style={{ paddingVertical: 60, textAlign: "center", fontFamily: F.sans, fontSize: 12.5, color: C.faint }}>{isLoading ? "" : "지워졌거나 볼 수 없는 기록입니다."}</Text>
      </View>
    );
  }

  const photos = photosOf(record);
  const cover = Math.min(record.cover_index ?? 0, Math.max(0, photos.length - 1));
  const idx = shown ?? cover;
  const current = photos[idx] ?? null;
  const menus = (record.menus ?? []).filter((m) => m.name.trim());
  const width = Dimensions.get("window").width;

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }}>
        <PhotoBox src={current} category={record.category} radius={0} style={{ width, height: current ? width : 268, ...(!current && { backgroundColor: "#efeade" }) }}>
          {!current && <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.4, color: C.faint }}>사진 없음</Text>}
        </PhotoBox>

        {photos.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" }} style={{ borderBottomWidth: 1, borderBottomColor: "#e6e0d3" }}>
            {photos.map((url, i) => (
              <Pressable key={url} onPress={() => setShown(i)} accessibilityLabel={`사진 ${i + 1}`}
                style={{ width: 54, height: 54, borderRadius: 14, overflow: "hidden", backgroundColor: "#eae5da", borderWidth: i === idx ? 1.5 : 1, borderColor: i === idx ? C.brick : "#ded8cb" }}>
                <SignedImage uri={url} style={{ width: "100%", height: "100%" }} />
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[FAINT_BOLD, { flexShrink: 1, fontFamily: F.serif, fontSize: 25, color: C.ink }]}>{record.name}</Text>
            {record.verified && <VerifiedMark size={24} />}
          </View>
          <Text style={{ marginTop: 7, fontFamily: F.sans, fontSize: 12, color: C.faint }}>
            {[record.category, record.region].filter(Boolean).join(" · ")}
          </Text>
          <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <MobileStars rating={record.rating} size={15} />
            <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.muted }}>{record.rating?.toFixed(1) ?? "—"}</Text>
            <View style={{ width: 1, height: 13, backgroundColor: "#ded8cb" }} />
            <Pigs row={record} w={18} h={17} />
          </View>

          <View style={{ marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: "#ded8cb", gap: 18 }}>
            <Field label="방문">
              {record.verified && record.verified_at ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 13.5, color: C.ink }}>{verifiedDateTime(record.verified_at)}</Text>
                  <VerifiedMark size={14} />
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontFamily: F.sans, fontSize: 13.5, color: C.ink }}>{dottedDate(record.visited_at) || "날짜 없음"}</Text>
                  <Text style={{ borderRadius: 10, borderWidth: 1, borderColor: C.line, paddingHorizontal: 8, paddingVertical: 2, fontFamily: F.sans, fontSize: 10.5, color: C.faint, overflow: "hidden" }}>인증 없음</Text>
                </View>
              )}
            </Field>
            {(menus.length > 0 || !!record.menu) && (
              <Field label="메뉴">
                {menus.length > 0 ? (
                  <View style={{ gap: 5 }}>
                    {menus.map((m, i) => (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {m.vote === 1 && <ThumbIcon size={13} stroke={C.brick} />}
                        {m.vote === -1 && <ThumbIcon size={13} stroke={C.faint} down />}
                        <Text style={{ fontFamily: F.sans, fontSize: 13.5, color: C.ink }}>{m.name}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ fontFamily: F.sans, fontSize: 13.5, lineHeight: 22, color: C.ink }}>{record.menu}</Text>
                )}
              </Field>
            )}
            <Field label="주소">
              <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: "#4d4842" }}>{record.address ?? record.region ?? "주소 미등록"}</Text>
            </Field>
          </View>

          {(record.keywords ?? []).length > 0 && (
            <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {record.keywords.map((k) => (
                <Text key={k} style={{ borderRadius: 14, borderWidth: 1, borderColor: "#e2dccf", paddingHorizontal: 10, paddingVertical: 4, fontFamily: F.sans, fontSize: 11, color: C.muted, overflow: "hidden" }}>{k}</Text>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <View style={{ position: "absolute", left: 16, top: insets.top + 8, backgroundColor: "rgba(251,250,246,.92)", borderRadius: 22 }}>
        <BackButton />
      </View>
    </View>
  );
}
