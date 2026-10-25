import { useState } from "react";
import { Modal, View } from "react-native";
import { Text } from "@/components/Text";
import Animated, { FadeIn, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { BookmarkIcon } from "@/components/icons";
import { BottomSheetModal, Button, Chip, Eyebrow, PhotoBox, Toggle } from "@/components/ui";
import { sourceShort } from "@/lib/sourceLink";
import { dottedDate, type Restaurant, type Wish } from "@/lib/types";
import type { Place } from "@/lib/places";
import { Pressable } from "react-native";
import { C, F, FAINT_BOLD, SHADOW } from "@/theme";

/** 「필터」 시트. */
export function FilterSheet(p: {
  visible: boolean; categories: string[]; keywords: string[];
  selectedCategories: string[]; selectedKeywords: string[]; revisitOnly: boolean; verifiedOnly: boolean; boundsOnly: boolean; count: number;
  onToggleCategory: (c: string) => void; onToggleKeyword: (k: string) => void; onToggleRevisit: () => void;
  onToggleVerified: () => void; onToggleBounds: () => void; onReset: () => void; onClose: () => void;
}) {
  return (
    <BottomSheetModal visible={p.visible} onClose={p.onClose}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontFamily: F.serif, fontSize: 18, color: C.ink }}>필터</Text>
        <Pressable onPress={p.onReset} style={{ paddingVertical: 6 }}><Text style={{ fontFamily: F.sans, fontSize: 12, color: C.faint }}>모두 지우기</Text></Pressable>
      </View>

      {p.categories.length > 0 && (
        <>
          <View style={{ marginTop: 16 }}><Eyebrow>종류</Eyebrow></View>
          <View style={{ marginTop: 9, flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {p.categories.map((c) => <Chip key={c} label={c} active={p.selectedCategories.includes(c)} onPress={() => p.onToggleCategory(c)} />)}
          </View>
        </>
      )}
      {p.keywords.length > 0 && (
        <>
          <View style={{ marginTop: 18 }}><Eyebrow>낱말</Eyebrow></View>
          <View style={{ marginTop: 9, flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {p.keywords.map((k) => <Chip key={k} label={k} active={p.selectedKeywords.includes(k)} onPress={() => p.onToggleKeyword(k)} />)}
          </View>
        </>
      )}
      <View style={{ marginTop: 18, flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        <Chip label="재방문한 곳만" active={p.revisitOnly} onPress={p.onToggleRevisit} />
        <Chip label="인증된 기록만" active={p.verifiedOnly} onPress={p.onToggleVerified} />
      </View>
      {/* 지금 지도에 보이는 범위 안 기록만 — 켜는 순간의 범위로 고정합니다. */}
      <Pressable onPress={p.onToggleBounds} style={{ marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
        <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.ink }}>현 지도에 있는 기록만</Text>
        <Toggle value={p.boundsOnly} onChange={p.onToggleBounds} label="현 지도에 있는 기록만" />
      </Pressable>
      <Button label={`${p.count}곳 보기`} onPress={p.onClose} style={{ marginTop: 22, minHeight: 54, borderRadius: 20 }} />
    </BottomSheetModal>
  );
}

/** 정렬 고르기 — 시트 대신 「최근순 ▾」 바로 아래에 작은 상자로 펼칩니다. 바깥을 누르면 닫힙니다. */
export function SortMenu<T extends string>(p: {
  anchor: { right: number; top: number } | null; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; onClose: () => void;
}) {
  return (
    <Modal visible={!!p.anchor} transparent animationType="none" onRequestClose={p.onClose} statusBarTranslucent>
      <Pressable onPress={p.onClose} style={{ flex: 1 }}>
        {p.anchor && (
          <Animated.View
            entering={FadeIn.duration(120)}
            style={[{ position: "absolute", right: p.anchor.right, top: p.anchor.top, minWidth: 128, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingVertical: 4 }, SHADOW.big]}
          >
            {p.options.map((o) => {
              const on = o.value === p.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => { p.onChange(o.value); p.onClose(); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({ minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, paddingHorizontal: 14, backgroundColor: pressed ? C.seg : "transparent" })}
                >
                  <Text style={{ fontFamily: on ? F.sansMd : F.sans, fontSize: 13, color: on ? C.ink : C.muted }}>{o.label}</Text>
                  <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.ink, opacity: on ? 1 : 0 }}>✓</Text>
                </Pressable>
              );
            })}
          </Animated.View>
        )}
      </Pressable>
    </Modal>
  );
}

/** 지도 검색에서 이미 있는 가게를 찾았을 때, 또는 기록 핀을 눌렀을 때의 작은 시트. */
export function FoundSheet(p: {
  hit: { restaurant: Restaurant; place: Place; fromPin?: boolean } | null; onClose: () => void; onRevisit: () => void; onWish: () => void; onOpen: () => void;
}) {
  const r = p.hit?.restaurant;
  const body = r && p.hit && (
        <>
          {!p.hit.fromPin && <Eyebrow wide>찾았습니다</Eyebrow>}
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[FAINT_BOLD, { marginTop: p.hit.fromPin ? 0 : 6, fontFamily: F.serif, fontSize: 22, color: C.ink }]}>{r.name}</Text>
              <Text style={{ marginTop: 4, fontFamily: F.sans, fontSize: 11.5, color: C.faint }}>{[r.category, r.region].filter(Boolean).join(" · ")}</Text>
              <Text style={{ marginTop: 6, fontFamily: F.mono, fontSize: 10.5, color: C.dim }}>
                {[`★ ${p.hit.place.rating == null ? "—" : p.hit.place.rating.toFixed(1)}`, `기록 ${p.hit.place.visits.length}건`,
                  p.hit.place.latest.visited_at && `${dottedDate(p.hit.place.latest.visited_at)} 방문`].filter(Boolean).join(" · ")}
              </Text>
            </View>
            {/* 대표 사진 — 사진을 붙인 가장 최근 기록의 커버. 없으면 비워 둡니다. */}
            {p.hit.place.photo && <PhotoBox src={p.hit.place.photo} category={r.category} size={64} radius={14} />}
          </View>
          <View style={{ marginTop: 14, flexDirection: "row", gap: 8 }}>
            <Button label="기록 추가" onPress={p.onRevisit} style={{ flex: 1, minHeight: 48, borderRadius: 16 }} />
            <Pressable onPress={p.onWish} accessibilityLabel="위시리스트에 담기" style={{ width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center" }}>
              <BookmarkIcon size={16} stroke={C.muted} />
            </Pressable>
            <Button kind="line" label="기록 보기" onPress={p.onOpen} style={{ minHeight: 48, borderRadius: 16, borderColor: C.line2 }} />
          </View>
        </>
  );
  // 핀에서 연 요약은 모달이 아닌 카드 — 화면을 덮지 않고 제 높이만큼만 올라오며, 지도는 그대로 만질 수 있습니다.
  // 지도를 밀거나 누르면 바로 내려갑니다(index 의 onCameraChanged · onTapMap).
  if (p.hit?.fromPin) {
    return (
      <Animated.View
        entering={SlideInDown.duration(200)}
        exiting={SlideOutDown.duration(140)}
        style={[{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 }, SHADOW.sheet]}
      >
        {body}
      </Animated.View>
    );
  }
  return (
    <BottomSheetModal visible={!!p.hit} onClose={p.onClose}>
      {body}
    </BottomSheetModal>
  );
}

/**
 * 같은 가게를 여러 번 담은 위시 핀을 눌렀을 때의 카드 — 「N군데에서 담았어요」, 펼치면 담은 위시마다 한 줄(그룹 · 출처 · 담은 날).
 * 줄을 누르면 그 위시로 갑니다. 다른 핀을 누르면 접힌 채로 다시 열리게 key 를 대표 위시 id 로 씁니다. 기록 핀 카드처럼 지도를 덮지 않고, 지도를 밀거나 누르면 내려갑니다.
 */
export function WishPinCard(p: { wishes: Wish[] | null; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const lead = p.wishes?.[0];
  if (!p.wishes || !lead) return null;
  return (
    <Animated.View
      entering={SlideInDown.duration(200)}
      exiting={SlideOutDown.duration(140)}
      style={[{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 }, SHADOW.sheet]}
    >
      <Text style={[FAINT_BOLD, { fontFamily: F.serif, fontSize: 22, color: C.ink }]}>{lead.name}</Text>
      {!!(lead.category || lead.where_text) && (
        <Text numberOfLines={1} style={{ marginTop: 4, fontFamily: F.sans, fontSize: 11.5, color: C.faint }}>{[lead.category, lead.where_text].filter(Boolean).join(" · ")}</Text>
      )}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ marginTop: 12, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: C.brickLine, backgroundColor: C.brickSoft, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
      >
        <Text style={{ fontFamily: F.sansMd, fontSize: 13, color: C.brick }}>{p.wishes.length}군데에서 담았어요</Text>
        <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.brick }}>{open ? "접기 ▴" : "펼치기 ▾"}</Text>
      </Pressable>
      {open && (
        <View style={{ marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, overflow: "hidden" }}>
          {p.wishes.map((w, i) => (
            <Pressable
              key={w.id}
              onPress={() => p.onOpen(w.id)}
              accessibilityRole="button"
              style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: pressed ? "#f3f0e9" : C.card, borderTopWidth: i ? 1 : 0, borderTopColor: C.line })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontFamily: F.sansMd, fontSize: 13.5, color: C.ink }}>{w.group?.name ?? "따로 담음"}</Text>
                <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 11.5, color: C.muted }}>
                  {[w.source_kind ? `${sourceShort(w.source_kind)}에서` : null, `${dottedDate(w.saved_at.slice(0, 10))} 담음`, w.plan_date ? `${dottedDate(w.plan_date)} 예정` : null].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Text style={{ fontSize: 16, color: C.faint }}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

/** 「아직 없는 곳」 — 기록에도 위시에도 없는 이름을 검색했을 때. */
export function SearchMissSheet(p: { name: string | null; onAddRecord: () => void; onAddWish: () => void; onClose: () => void }) {
  return (
    <BottomSheetModal visible={!!p.name} onClose={p.onClose}>
      <Eyebrow wide>아직 없는 곳</Eyebrow>
      <Text style={{ marginTop: 6, fontFamily: F.serif, fontSize: 22, color: C.ink }}>{p.name}</Text>
      <Text style={{ marginTop: 6, fontFamily: F.sans, fontSize: 11.5, lineHeight: 18, color: C.faint }}>기록에도 위시리스트에도 없는 이름입니다. 어느 쪽으로 둘까요?</Text>
      <View style={{ marginTop: 14, gap: 8 }}>
        <Button label="다녀왔어요 · 기록 추가" onPress={p.onAddRecord} style={{ borderRadius: 18 }} />
        <Pressable onPress={p.onAddWish} style={{ minHeight: 50, borderRadius: 18, borderWidth: 1, borderColor: C.line2, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }}>
          <BookmarkIcon size={14} stroke={C.ink} />
          <Text style={{ fontFamily: F.sansMd, fontSize: 13.5, color: C.ink }}>가고 싶어요 · 예정 추가</Text>
        </Pressable>
      </View>
    </BottomSheetModal>
  );
}
