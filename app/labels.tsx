import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { LabelBadge } from "@/components/Badges";
import { BackButton, BottomSheetModal, Button, Eyebrow } from "@/components/ui";
import { refreshAll } from "@/data/invalidate";
import { usePersonalRows } from "@/data/queries";
import { useTourDefs } from "@/features/recommend/api";
import { useAccount } from "@/data/profile";
import { EmptySlot, Stamp, StampBoard } from "@/features/stamps/Stamp";
import { useSeenLabels } from "@/lib/labelSeen";
import { currentBoard, earnedLabels, regionTitles, stampRows, STAMPS_PER_BOARD, tourTitles, type EarnedLabel } from "@/lib/labels";
import { supabase } from "@/lib/supabase";
import type { Restaurant } from "@/lib/types";
import { C, F } from "@/theme";

/**
 * 라벨첩(지시서 4 §4) — 도장판 카드(아래 도장 수 8단계 이정표) · 이야기 목록 · 동네 칭호 칩 · 투어 칭호 칩(누르면 그 투어).
 * 받은 이정표 점을 누르면 리캡, 이야기 줄을 누르면 메달 · 도장 · 채운 가게 시트(「기록 보기」로 리캡).
 * 받은 라벨 · 투어 칭호를 길게 누르면 닉네임 옆 대표 라벨로 붙습니다.
 */
export default function Labels() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: rows = [], isSuccess } = usePersonalRows();
  const { data: account } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<EarnedLabel | null>(null);

  const titleId = account?.titleLabelId ?? null;
  const labels = earnedLabels(rows);
  const bowls = labels.filter((l) => l.group === "bowl");
  const stamps = stampRows(rows).length;
  const stories = labels.filter((l) => l.group === "story");
  const seen = useSeenLabels(account?.userId, labels.filter((l) => l.earned).map((l) => l.id), isSuccess);
  // 인증 기록이 한 건이라도 있는 구는 모두 — 칭호를 받기 전이면 회색으로 다음 칭호까지 보여 줍니다.
  const districts = regionTitles(rows);
  // 투어 칭호 — 받은 것 먼저, 그다음 진행 중인 투어. 받지 못한 채 끝난 투어는 숨깁니다.
  const { data: tourDefs = [] } = useTourDefs();
  const tours = tourTitles(tourDefs, rows).filter((t) => !t.closed).sort((a, b) => Number(b.earned) - Number(a.earned) || b.have / b.need - a.have / a.need);
  // 대표 라벨 — 라벨이거나 완주한 투어 칭호. 투어 칭호는 아이콘 대신 ✓ 원.
  const titleLabel = labels.find((l) => l.id === titleId && l.earned) ?? null;
  const titleTour = tours.find((t) => t.titleId === titleId && t.earned) ?? null;
  const title = titleLabel ? { name: titleLabel.name, color: titleLabel.color, icon: titleLabel.icon as string | null } : titleTour ? { name: titleTour.name, color: C.brick, icon: null } : null;

  const open = (l: EarnedLabel) => {
    if (!l.earned) return;
    router.push({ pathname: "/label-recap", params: { id: l.id } });
  };

  async function toggleTitle(l: { id: string; earned: boolean }) {
    if (busy || !l.earned) return;
    Haptics.selectionAsync();
    const next = titleId === l.id ? null : l.id;
    setBusy(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("로그인이 필요합니다"); setBusy(false); return; }
    const { error: err } = await supabase.from("profiles").upsert({ id: user.id, title_label_id: next });
    setBusy(false);
    if (err) return setError(err.message);
    refreshAll(qc);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 14, paddingBottom: 6 }}>
        <BackButton />
        <View style={{ paddingHorizontal: 8, marginTop: 6 }}>
          <Eyebrow wide>LABELS</Eyebrow>
          <Text style={{ marginTop: 8, fontFamily: F.serif, fontSize: 26, color: C.ink }}>라벨첩</Text>
        </View>
      </View>
      {!!error && <Text style={{ paddingHorizontal: 22, marginTop: 6, fontFamily: F.sans, fontSize: 11, color: C.brick }}>{error}</Text>}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 40 }}>
        <View style={{ marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: "#e6e0d3", backgroundColor: C.card, flexDirection: "row", alignItems: "center", gap: 12 }}>
          {title ? (
            <>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: title.color, alignItems: "center", justifyContent: "center" }}>
                {title.icon ? (
                  <Svg width={18} height={18} viewBox="0 0 24 24">
                    <Path d={title.icon} fill="none" stroke={C.card} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                ) : (
                  <Text style={{ fontSize: 14, color: C.card }}>✓</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: F.sansBd, fontSize: 12.5, color: C.ink }}>
                  {account?.nickname || "나"}
                  <Text style={{ color: title.color }}> · {title.name}</Text>
                </Text>
                <Text style={{ marginTop: 2, fontFamily: F.sans, fontSize: 10.5, color: C.faint }}>라벨을 길게 누르면 대표 라벨이 바뀌어요</Text>
              </View>
            </>
          ) : (
            <>
              <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderStyle: "dashed", borderColor: "#cfc7b6" }} />
              <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 12.5, color: C.muted }}>라벨을 길게 누르면 대표 라벨로 붙어요</Text>
            </>
          )}
        </View>

        <StampCard
          stamps={stamps}
          bowls={bowls}
          titleId={titleId}
          isNew={seen.isNew}
          onOpen={open}
          onLongPress={toggleTitle}
        />

        <SectionHead title="이야기" right={`${stories.filter((l) => l.earned).length} / ${stories.length}`} />
        <View style={{ marginTop: 10, borderRadius: 18, borderWidth: 1, borderColor: C.lineSoft, backgroundColor: C.card, overflow: "hidden" }}>
          {stories.map((l, i) => {
            const fresh = l.earned && seen.isNew(l.id);
            return (
              <Pressable
                key={l.id}
                onPress={() => setDetail(l)}
                onLongPress={() => toggleTitle(l)}
                accessibilityLabel={`${l.name}${l.earned ? "" : " · 아직"} 자세히 보기`}
                style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: "#ece7dc" }}
              >
                <LabelBadge label={l} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.serif, fontSize: 14, color: l.earned ? C.ink : C.muted }}>
                    {l.name}
                    {l.id === titleId && <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.brick }}>  대표</Text>}
                    {fresh && <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.brick }}>  · 새로</Text>}
                  </Text>
                  <Text style={{ marginTop: 2, fontFamily: F.sans, fontSize: 11, color: C.faint }}>{l.desc}</Text>
                </View>
                {l.earned ? (
                  <Pressable onPress={() => open(l)} hitSlop={10} accessibilityLabel={`${l.name} 기록 보기`}>
                    <Text style={{ fontFamily: F.sansMd, fontSize: 11.5, color: C.brick }}>기록 보기 ›</Text>
                  </Pressable>
                ) : (
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.faint }}>{Math.min(l.have, l.need)} / {l.need}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <SectionHead title="동네 칭호" right={`${districts.filter((t) => t.tier).length}`} />
        {districts.length > 0 ? (
          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {districts.map((t) =>
              t.tier ? (
                <View key={t.region} style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 13, borderWidth: 1, borderColor: `${t.tier.color}66`, backgroundColor: `${t.tier.color}1a`, paddingHorizontal: 11, paddingVertical: 5 }}>
                  <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: t.tier.color }}>{t.region} {t.tier.suffix}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 9, color: t.tier.color }}>{"★★★".slice(0, t.tier.stars)}</Text>
                </View>
              ) : (
                <View key={t.region} accessibilityLabel={`${t.region} ${t.next!.suffix} · 아직 ${t.have} / ${t.next!.need}`} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 13, borderWidth: 1, borderStyle: "dashed", borderColor: "#d6cfc2", backgroundColor: "#f3efe6", paddingHorizontal: 11, paddingVertical: 5 }}>
                  <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.faint }}>{t.region} {t.next!.suffix}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 9.5, color: "#bdb4a3" }}>{t.have} / {t.next!.need}</Text>
                </View>
              )
            )}
          </View>
        ) : (
          <Text style={{ marginTop: 10, fontFamily: F.sans, fontSize: 12, color: C.faint }}>한 구에서 인증 기록 10건이면 첫 칭호를 받아요</Text>
        )}

        <SectionHead title="투어 칭호" right={`${tours.filter((t) => t.earned).length}`} />
        {tours.length > 0 ? (
          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {tours.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push({ pathname: "/recommend/tour/[id]", params: { id: t.id } })}
                onLongPress={() => toggleTitle({ id: t.titleId, earned: t.earned })}
                accessibilityLabel={t.earned ? `${t.name} · ${t.tour} 완주${t.titleId === titleId ? " · 대표" : ""}` : `${t.name} · ${t.tour} ${t.have} / ${t.need}`}
                style={t.earned
                  ? { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 13, borderWidth: t.titleId === titleId ? 1.5 : 1, borderColor: t.titleId === titleId ? C.ink : "rgba(180,85,45,.4)", backgroundColor: C.brickSoft, paddingHorizontal: 11, paddingVertical: 5 }
                  : { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 13, borderWidth: 1, borderStyle: "dashed", borderColor: "#d6cfc2", backgroundColor: "#f3efe6", paddingHorizontal: 11, paddingVertical: 5 }}
              >
                <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: t.earned ? C.brick : C.faint }}>{t.name}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 9.5, color: t.earned ? C.brick : "#bdb4a3" }}>{t.earned ? "✓" : `${t.have} / ${t.need}`}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={{ marginTop: 10, fontFamily: F.sans, fontSize: 12, color: C.faint }}>추천 탭 「둘러보기」의 투어를 완주하면 칭호를 받아요</Text>
        )}
      </ScrollView>
      {detail && (
        <LabelSheet
          label={detail}
          rows={rows}
          isTitle={detail.id === titleId}
          onClose={() => setDetail(null)}
          onRecap={() => { setDetail(null); open(detail); }}
        />
      )}
    </View>
  );
}

/** 이야기 라벨 시트 — 큰 메달, 채운 만큼 찍힌 도장, 어느 가게를 몇 번 가서 채웠는지. */
function LabelSheet({ label, rows, isTitle, onClose, onRecap }: {
  label: EarnedLabel; rows: Restaurant[]; isTitle: boolean; onClose: () => void; onRecap: () => void;
}) {
  const { height } = useWindowDimensions();
  const contrib = label.contrib(rows);
  const stores = new Map<string, { name: string; n: number }>();
  for (const r of contrib) {
    const k = r.place_key ?? `${r.name}|${r.address ?? ""}`;
    const s = stores.get(k);
    if (s) s.n += 1;
    else stores.set(k, { name: r.name, n: 1 });
  }
  const list = [...stores.values()].sort((a, b) => b.n - a.n);
  const size = 34, gap = 8;

  return (
    <BottomSheetModal visible onClose={onClose}>
      <ScrollView style={{ maxHeight: height * 0.72 }} contentContainerStyle={{ alignItems: "center", paddingBottom: 6 }}>
        <LabelBadge label={label} selected={isTitle} size={132} />
        <Text style={{ marginTop: 14, fontFamily: F.serif, fontSize: 21, color: label.earned ? C.ink : C.muted }}>{label.name}</Text>
        <Text style={{ marginTop: 5, fontFamily: F.sans, fontSize: 12, color: C.faint }}>
          {label.desc} · <Text style={{ fontFamily: F.mono, color: label.earned ? label.color : C.faint }}>{Math.min(label.have, label.need)} / {label.need}</Text>
        </Text>

        <View style={{ marginTop: 18, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", width: size * 5 + gap * 4, rowGap: gap, columnGap: gap }}>
          {Array.from({ length: label.need }, (_, i) =>
            i < contrib.length ? <Stamp key={i} size={size} /> : <EmptySlot key={i} size={size} label={i + 1} />,
          )}
        </View>

        <View style={{ alignSelf: "stretch", marginTop: 20, borderRadius: 16, borderWidth: 1, borderColor: C.lineSoft, backgroundColor: C.card }}>
          {list.length > 0 ? list.map((s, i) => (
            <View key={s.name + i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: "#ece7dc" }}>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.sans, fontSize: 13, color: C.ink }}>{s.name}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.brick }}>{s.n}번</Text>
            </View>
          )) : (
            <Text style={{ padding: 14, fontFamily: F.sans, fontSize: 12, color: C.faint, textAlign: "center" }}>아직 채운 가게가 없어요</Text>
          )}
        </View>
      </ScrollView>
      {label.earned && <Button style={{ marginTop: 14 }} label="기록 보기" onPress={onRecap} />}
    </BottomSheetModal>
  );
}

/**
 * 도장판 카드 — 지금 채우는 판 5×2, 아래 도장 수 8단계 이정표(값과 상관없이 같은 간격).
 * 받은 단계는 D 점(마지막으로 받은 단계엔 바깥 링), 선은 마지막으로 받은 점까지 벽돌색.
 */
function StampCard({ stamps, bowls, titleId, isNew, onOpen, onLongPress }: {
  stamps: number; bowls: EarnedLabel[]; titleId: string | null; isNew: (id: string) => boolean;
  onOpen: (l: EarnedLabel) => void; onLongPress: (l: EarnedLabel) => void;
}) {
  const { width } = useWindowDimensions();
  const board = currentBoard(stamps);
  // 화면 여백 22 · 카드 안쪽 18 · 테두리 1 을 빼고 5칸 · 간격 8.
  const size = Math.min(48, Math.floor((width - 44 - 38 - 8 * 4) / 5));
  const last = bowls.reduce((at, l, i) => (l.earned ? i : at), -1);
  return (
    <View style={{ marginTop: 24, borderRadius: 22, borderWidth: 1, borderColor: C.lineSoft, backgroundColor: C.card, padding: 18 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ fontFamily: F.serif, fontSize: 16, color: C.ink }}>도장판</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 10.5, color: C.faint }}>{board.board}장째 · {board.filled} / {STAMPS_PER_BOARD}</Text>
      </View>
      <View style={{ marginTop: 14, alignItems: "center" }}>
        <StampBoard filled={board.filled} firstNo={(board.board - 1) * STAMPS_PER_BOARD + 1} size={size} gap={8} numberEmpty />
      </View>

      <View style={{ marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: C.lineSoft }}>
        <View pointerEvents="none" style={{ position: "absolute", top: 18 + 10, left: 11, right: 11, height: 2, backgroundColor: C.lineSoft }}>
          {last > 0 && <View style={{ width: `${(last / (bowls.length - 1)) * 100}%`, height: 2, backgroundColor: C.brick }} />}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {bowls.map((l, i) => {
            const now = i === last;
            return (
              <Pressable
                key={l.id}
                onPress={() => onOpen(l)}
                onLongPress={() => onLongPress(l)}
                disabled={!l.earned}
                hitSlop={8}
                accessibilityLabel={`${l.name}${l.earned ? (l.id === titleId ? " · 대표" : "") + (isNew(l.id) ? " · 새로" : "") : " · 아직"}`}
                style={{ width: 22, alignItems: "center" }}
              >
                <View
                  style={{
                    width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center",
                    ...(l.earned ? { backgroundColor: C.brick } : { backgroundColor: C.card, borderWidth: 1.5, borderColor: "#d6cfc2" }),
                    ...(now && { boxShadow: "0 0 0 4px #f2e0d5" }),
                  }}
                >
                  {l.earned && <Text style={{ fontFamily: F.serif, fontSize: 10, lineHeight: 13, color: "#fff", textShadowColor: "#fff", textShadowRadius: 1 }}>D</Text>}
                </View>
                <Text numberOfLines={1} style={{ marginTop: 6, width: 34, textAlign: "center", fontFamily: F.mono, fontSize: 10, color: now ? C.brick : l.earned ? C.ink : "#a8a196" }}>{l.need}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const SectionHead = ({ title, right }: { title: string; right: string }) => (
  <View style={{ paddingTop: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
    <Text style={{ fontFamily: F.serif, fontSize: 15, color: C.ink }}>{title} <Text style={{ fontFamily: F.mono, fontSize: 13 }}>{right}</Text></Text>
  </View>
);

export { ErrorBoundary } from "expo-router";
