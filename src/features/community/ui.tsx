import { useNavigation, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, View, type ViewStyle } from "react-native";
import { Text } from "@/components/Text";
import { HeartIcon } from "@/components/icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useTourDefs } from "@/features/recommend/api";
import { LABELS, tourTitleName } from "@/lib/labels";
import { C, F } from "@/theme";
import { SignedImage } from "@/lib/signedPhoto";

/** 디자인에서 거듭 쓰는 색 — 토큰(src/theme)에 없는 것만. */
export const K = {
  inactive: "#a29a8c",
  text2: "#4d4842",
  brickLine: "#e0c3b1",
  brickInk: "#8f4323",
  seg: "#ebe6db",
  segMap: "#efebe2",
  ivory: "#f3ecdc",
  dashed: "#cdc6b8",
  stripe: "#ece7dc",
} as const;

/**
 * 커뮤니티를 통째로 닫고 원래 탭으로 — 어느 탭 · 어느 깊이에서든 「community」가 든 루트 스택에서 한 칸 내립니다.
 * 맨 위까지 올라가면 안 됩니다: expo-router 가 앱 루트 Stack 위에 route 하나짜리 내부 스택(__root)을 두어서
 * 거기선 canGoBack 이 늘 false 라 replace("/") 로 빠지고, (tabs) 가 하나 더 새로 떠 빈 화면이 됩니다.
 */
export function useExitCommunity() {
  const nav = useNavigation();
  const router = useRouter();
  return () => {
    let stack: typeof nav | undefined = nav;
    while (stack && !stack.getState()?.routes.some((r) => r.name === "community")) stack = stack.getParent<typeof nav | undefined>();
    if (stack?.canGoBack()) stack.goBack();
    else router.replace("/");
  };
}

/** 머리 — 왼쪽 알약(화살표 + 기본 「내 기록」), 오른쪽은 화면마다. 위 안전 영역 아래에 놓입니다. */
export function CommunityHeader({ back, right }: { back?: { label: string; onPress: () => void }; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const exit = useExitCommunity();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pill onPress={back?.onPress ?? exit} accessibilityLabel={back ? back.label : "내 기록으로 돌아가기"}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <BackArrow />
          <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: K.text2 }}>{back?.label ?? "내 기록"}</Text>
        </View>
      </Pill>
      <View style={{ flexDirection: "row", gap: 6 }}>{right}</View>
    </View>
  );
}

/** 알약 앞 ‹ — 글자와 비슷한 크기로 보이게 13px SVG. */
const BackArrow = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={K.text2} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 5l-7 7 7 7" />
  </Svg>
);

export const Pill = ({ label, onPress, children, accessibilityLabel }: { label?: string; onPress?: () => void; children?: React.ReactNode; accessibilityLabel?: string }) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress}
    hitSlop={6}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    style={{ height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingLeft: 10, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 5 }}
  >
    {children}
    {label != null && <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: K.text2 }}>{label}</Text>}
  </Pressable>
);

export const RoundButton = ({ onPress, label, children, dot, borderColor = C.line }: { onPress?: () => void; label: string; children: React.ReactNode; dot?: boolean; borderColor?: string }) => (
  <Pressable
    onPress={onPress}
    accessibilityLabel={label}
    hitSlop={4}
    style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}
  >
    {children}
    {dot && <View style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: 4, backgroundColor: C.brick }} />}
  </Pressable>
);

/** 제목 덩어리 — eyebrow · Gowun 22 제목(선택) · 부제(선택). aside 는 제목 줄 오른쪽 — 제목이 없으면(내 기록 탭처럼 영문 eyebrow 만) eyebrow 줄 오른쪽. */
export function TitleBlock({ eyebrow, title, sub, aside }: { eyebrow: string; title?: string; sub?: string; aside?: React.ReactNode }) {
  const label = <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2.2, color: C.faint }}>{eyebrow}</Text>;
  return (
    <View style={{ paddingTop: 14, paddingHorizontal: 20 }}>
      {title ? (
        <>
          {label}
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: F.serif, fontSize: 22, color: C.ink }}>{title}</Text>
            {aside}
          </View>
        </>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {label}
          {aside}
        </View>
      )}
      {!!sub && <Text style={{ marginTop: 6, fontFamily: F.sans, fontSize: 12, color: C.faint }}>{sub}</Text>}
    </View>
  );
}

/** 큰 전환(높이 38) — 친구 「소식 | 친구 지도」. */
export function Segmented<T extends string>({ value, options, onChange, style }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; style?: ViewStyle }) {
  return (
    <View style={[{ height: 38, borderRadius: 19, backgroundColor: K.seg, padding: 3, flexDirection: "row", gap: 3 }, style]}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => { if (!on) { Haptics.selectionAsync(); onChange(o.id); } }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[{ flex: 1, borderRadius: 16, alignItems: "center", justifyContent: "center" }, on && { backgroundColor: C.card, shadowColor: C.ink, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 }]}
          >
            <Text style={{ fontFamily: on ? F.sansMd : F.sans, fontSize: 12.5, color: on ? C.ink : C.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 작은 전환(높이 30) — 랭킹 「친구 | 전체」. */
export function MiniSegment<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={{ height: 30, borderRadius: 15, backgroundColor: K.seg, padding: 3, flexDirection: "row", gap: 2 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} onPress={() => { if (!on) { Haptics.selectionAsync(); onChange(o.id); } }} accessibilityState={{ selected: on }}
            style={{ borderRadius: 12, paddingHorizontal: 11, justifyContent: "center", backgroundColor: on ? C.card : "transparent" }}>
            <Text style={{ fontFamily: on ? F.sansMd : F.sans, fontSize: 11.5, color: on ? C.ink : C.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 거르기 칩 줄(높이 32) — 켜진 것은 먹색. */
export function FilterChips<T extends string>({ value, options, onChange, trailing, contentRef }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; trailing?: React.ReactNode; contentRef?: React.Ref<View> }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
      <View ref={contentRef} collapsable={false} style={{ flexDirection: "row", gap: 6 }}>
        {options.map((o) => {
          const on = o.id === value;
          return (
            <Pressable key={o.id} onPress={() => { Haptics.selectionAsync(); onChange(o.id); }} accessibilityState={{ selected: on }}
              style={{ height: 32, borderRadius: 16, paddingHorizontal: 13, justifyContent: "center", backgroundColor: on ? C.ink : C.card, borderWidth: on ? 0 : 1, borderColor: C.line }}>
              <Text style={{ fontFamily: on ? F.sansMd : F.sans, fontSize: 12, color: on ? C.card : K.text2 }}>{o.label}</Text>
            </Pressable>
          );
        })}
        {trailing}
      </View>
    </ScrollView>
  );
}

const AVATAR_BG = ["#e9d6c8", "#d9e0cf", "#d8dbe4", "#ecdcb8", "#e4dfd3"];
const tint = (seed: string) => AVATAR_BG[[...seed].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_BG.length];

/** 동그란 얼굴 — 사진이 있으면 사진, 없으면 첫 글자(Gowun). ring 이면 2px 벽돌 테두리 + 2px 틈. */
export function Avatar({ name, url, size, ring, seed }: { name: string; url?: string | null; size: number; ring?: boolean; seed?: string }) {
  const inner = (
    <View style={{ width: ring ? size - 8 : size, height: ring ? size - 8 : size, borderRadius: size, overflow: "hidden", backgroundColor: tint(seed ?? name), alignItems: "center", justifyContent: "center" }}>
      {url ? (
        <SignedImage uri={url} style={{ width: "100%", height: "100%" }} />
      ) : (
        <Text style={{ fontFamily: F.serif, fontSize: Math.round(size * 0.38), color: C.ink }}>{(name || "?").slice(0, 1)}</Text>
      )}
    </View>
  );
  if (!ring) return inner;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: C.brick, padding: 2, alignItems: "center", justifyContent: "center" }}>{inner}</View>
  );
}

/** 칭호(대표 라벨) 이름. 없으면 null. */
/** 대표 라벨 이름 — 라벨이거나 투어 칭호(「tour:…」, 투어 목록을 받아 와야 보입니다 — 쓰는 화면에서 useTourDefs 를 불러 두세요). */
export const titleName = (id: string | null | undefined) => (id ? LABELS.find((l) => l.id === id)?.name ?? tourTitleName(id) : null);
const titleColor = (id: string | null | undefined) => (id ? LABELS.find((l) => l.id === id)?.color : undefined) ?? C.brick;

/** 이름 옆 칭호 칩 — 내계정과 같은 모양(라벨 색 30%/10%). */
export function TitleChip({ id }: { id: string | null | undefined }) {
  useTourDefs();
  const name = titleName(id);
  if (!name) return null;
  const color = titleColor(id);
  return (
    <Text style={{ borderRadius: 12, borderWidth: 1, borderColor: `${color}4d`, backgroundColor: `${color}1a`, paddingHorizontal: 7, paddingVertical: 2, fontFamily: F.sansBd, fontSize: 10, color, overflow: "hidden" }}>{name}</Text>
  );
}

/** 「✓ 인증」 점선 칩. */
/** 좋아요 — 하트 + 수(갤러리와 같은 모양). 누른 것만 빨갛게 채움. onPress 가 없으면(내 것) 수만 보여 줍니다. */
export function LikeButton({ on, count, onPress, disabled }: { on: boolean; count: number; onPress?: () => void; disabled?: boolean }) {
  const body = (
    <>
      <HeartIcon size={17} stroke={on ? C.heart : C.muted} fill={on ? C.heart : "none"} strokeWidth={1.8} />
      <Text style={{ fontFamily: on ? F.sansMd : F.sans, fontSize: 12, color: on ? C.heart : C.muted }}>{count}</Text>
    </>
  );
  if (!onPress) return <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>{body}</View>;
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      disabled={disabled}
      hitSlop={8}
      accessibilityLabel={on ? "좋아요 취소" : "좋아요"}
      accessibilityState={{ selected: on }}
      style={{ minHeight: 28, flexDirection: "row", alignItems: "center", gap: 4 }}
    >
      {body}
    </Pressable>
  );
}

export const VerifiedChip = ({ label = "✓ 인증" }: { label?: string }) => (
  <Text style={{ borderRadius: 9, borderWidth: 1, borderStyle: "dashed", borderColor: C.brick, paddingHorizontal: 7, fontFamily: F.mono, fontSize: 10, color: C.brick, overflow: "hidden" }}>{label}</Text>
);

/** 형식 꼬리표 — 기록 나눔 · 주제 · 어디 가요? */
export const TagChip = ({ label }: { label: string }) => (
  <Text style={{ alignSelf: "flex-start", borderRadius: 6, backgroundColor: K.segMap, paddingHorizontal: 7, paddingVertical: 1, fontFamily: F.mono, fontSize: 10, color: C.muted, overflow: "hidden" }}>{label}</Text>
);

/** 줄무늬 자리(사진이 없을 때). */
export function PhotoOrStripes({ uri, height, width, radius, label }: { uri?: string | null; height: number; width?: number | "100%"; radius: number; label?: string }) {
  return (
    <View style={{ width: width ?? "100%", height, borderRadius: radius, overflow: "hidden", backgroundColor: K.stripe, alignItems: "center", justifyContent: "center" }}>
      {uri ? (
        <SignedImage uri={uri} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : label ? (
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.4, color: C.faint }}>{label}</Text>
      ) : null}
    </View>
  );
}

/** "방금" · "40분 전" · "2시간 전" · "3일 전" · "10.11" */
export function timeAgo(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}일 전`;
  const date = new Date(iso);
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, "0")}`;
}

/** "2026-10-11T…" → "10.11" (한국 날짜) */
export function monthDay(iso: string | null) {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  return p.replace("-", ".");
}

/** 주소에서 「분식 · 서울 마포구 망원동」 같은 메타 줄의 뒤쪽. */
export const shortAddr = (address: string | null, region: string | null) => {
  const parts = (address ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 3) return parts.slice(0, 3).join(" ");
  return region ?? address ?? "";
};
export const metaLine = (...xs: (string | null | undefined)[]) => xs.filter(Boolean).join(" · ");
