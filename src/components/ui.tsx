import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, type TextStyle, View, type ViewStyle } from "react-native";
import { Text } from "@/components/Text";
import { DialogHost } from "@/components/Dialog";
import { useIosKeyboardHeight, useKeyboardOpen } from "@/lib/keyboard";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VerifiedMark } from "./icons";
import { feltLevel, type PriceRow } from "@/lib/price";
import { pinColor } from "@/lib/types";
import { C, F, SHADOW } from "@/theme";
import { SignedImage } from "@/lib/signedPhoto";

export { VerifiedMark };

export const Eyebrow = ({ children, wide }: { children: React.ReactNode; wide?: boolean }) => (
  <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.faint, letterSpacing: wide ? 2.2 : 1.6 }}>{children}</Text>
);

export const BackButton = ({ onPress, label = "←" }: { onPress?: () => void; label?: string }) => {
  const router = useRouter();
  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      accessibilityLabel="뒤로"
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: 17, color: C.ink }}>{label}</Text>
    </Pressable>
  );
};

/** 화면 머리 — 뒤로가기 + eyebrow + 큰 제목(+ 부제). 보관함·라벨첩·상세가 같은 골격을 씁니다. */
export function ScreenHead({
  eyebrow, title, sub, onBack, right,
}: { eyebrow?: string; title: string; sub?: string; onBack?: () => void; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <BackButton onPress={onBack} />
        {right}
      </View>
      <View style={{ paddingHorizontal: 8, marginTop: 6 }}>
        {eyebrow && <Eyebrow wide>{eyebrow}</Eyebrow>}
        <Text style={{ marginTop: 8, fontFamily: F.serif, fontSize: 26, color: C.ink }}>{title}</Text>
        {sub && <Text style={{ marginTop: 6, fontFamily: F.sans, fontSize: 12, color: C.faint }}>{sub}</Text>}
      </View>
    </View>
  );
}

export const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    style={{
      minHeight: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 13, justifyContent: "center",
      borderColor: active ? C.brick : "#cdc6b8", backgroundColor: active ? C.brick : "transparent",
    }}
  >
    <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: active ? "#fdf9f3" : "#4a453d" }}>{label}</Text>
  </Pressable>
);

export const fieldStyle = {
  marginTop: 8, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: "#ded8cb", backgroundColor: C.card,
  paddingHorizontal: 15, fontFamily: F.sans, fontSize: 13.5, color: C.ink,
} as const;

export const Button = ({
  label, onPress, kind = "dark", disabled, style, icon,
}: { label: string; onPress: () => void; kind?: "dark" | "brick" | "line"; disabled?: boolean; style?: ViewStyle; icon?: React.ReactNode }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={[
      {
        minHeight: 50, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 16,
        flexDirection: "row", gap: 7,
        backgroundColor: kind === "dark" ? C.ink : kind === "brick" ? C.brick : "transparent",
        borderWidth: kind === "line" ? 1 : 0, borderColor: "#ded8cb", opacity: disabled ? 0.5 : 1,
      },
      style,
    ]}
  >
    {icon}
    <Text style={{ fontFamily: F.sansMd, fontSize: 13.5, color: kind === "line" ? C.ink : C.card }}>{label}</Text>
  </Pressable>
);

/** 부분 채움 별점. */
export function MobileStars({ rating, size = 12.5 }: { rating: number | null; size?: number }) {
  const value = Math.max(0, Math.min(5, rating ?? 0));
  const row = { fontSize: size, letterSpacing: 1, lineHeight: size + 2 } as const;
  return (
    <View>
      <Text style={[row, { color: "#ded8cb" }]}>★★★★★</Text>
      <View style={{ position: "absolute", top: 0, left: 0, width: `${(value / 5) * 100}%`, overflow: "hidden" }}>
        <Text numberOfLines={1} style={[row, { color: C.brick, width: 200 }]}>★★★★★</Text>
      </View>
    </View>
  );
}

/** 체감 가격 돼지 다섯 마리. */
export function Pigs({ row, w = 15, h = 14 }: { row: PriceRow; w?: number; h?: number }) {
  const level = feltLevel(row);
  return (
    <View style={{ flexDirection: "row", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Image
          key={n}
          source={require("../../assets/piggy.png")}
          style={{ width: w, height: h, opacity: n <= level ? 1 : 0.3 }}
          resizeMode="contain"
        />
      ))}
    </View>
  );
}

/** 사진이 있으면 덮어 채우고, 없으면 종류 색의 연한 면. */
export function PhotoBox({
  src, category, size, radius = 15, style, children,
}: { src?: string | null; category?: string | null; size?: number; radius?: number; style?: ViewStyle; children?: React.ReactNode }) {
  const box: ViewStyle = {
    width: size, height: size, borderRadius: radius, overflow: "hidden", backgroundColor: pinColor(category ?? null) + "26",
    alignItems: "center", justifyContent: "center",
  };
  return (
    <View style={[box, style]}>
      {src ? <SignedImage uri={src} style={StyleSheet.absoluteFill} /> : null}
      {children}
    </View>
  );
}

/** 아래에서 올라오는 시트 — FilterSheet·SearchMissSheet·WishSheet 가 함께 씁니다. dim 은 뒤 화면을 덮는 어둡기(기본 .34). */
export function BottomSheetModal({
  visible, onClose, children, dim = 0.34,
}: { visible: boolean; onClose: () => void; children: React.ReactNode; dim?: number }) {
  const insets = useSafeAreaInsets();
  const iosKb = useIosKeyboardHeight(visible);
  // 키보드가 떠 있으면 시트 바닥을 키보드에 바짝 — 홈 표시줄 몫 여백은 키보드가 가립니다.
  const kbOpen = useKeyboardOpen(visible);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* 키보드가 올라오면 시트도 그 위로 — 모달은 창이 줄지 않아(안드로이드 edge-to-edge 포함) 직접 띄웁니다. 키가 크면 시트가 상태줄 아래까지 줄어듭니다.
          안드로이드는 KeyboardAvoidingView, iOS 는 키보드 높이만큼 시트 아래 빈칸(모달 안 KeyboardAvoidingView 가 iOS 에선 안 움직여서). */}
      <KeyboardAvoidingView behavior="padding" enabled={Platform.OS === "android"} style={{ flex: 1, justifyContent: "flex-end", paddingTop: insets.top, backgroundColor: `rgba(28,26,23,${dim})` }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="닫기" />
        <View
          style={[
            { flexShrink: 1, backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18, paddingBottom: kbOpen ? 6 : insets.bottom + 20 },
            SHADOW.sheet,
          ]}
        >
          {children}
        </View>
        {/* 시트가 떠 있는 동안의 알림창은 시트 안에서 — iOS 는 뿌리에서 시트 위로 못 띄웁니다. */}
        <DialogHost />
        {iosKb > 0 && <View style={{ height: iosKb, backgroundColor: C.paper }} />}
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** 켜고 끄는 스위치 — 50×28, 켜짐 벽돌색. */
export const Toggle = ({
  value, onChange, disabled, label,
}: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) => (
  <Pressable
    onPress={() => onChange(!value)}
    disabled={disabled}
    hitSlop={8}
    accessibilityRole="switch"
    accessibilityLabel={label}
    accessibilityState={{ checked: value, disabled }}
    style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: value ? C.brick : "#d8d3c8" }}
  >
    <View style={{ position: "absolute", top: 2, left: value ? 24 : 2, width: 24, height: 24, borderRadius: 12, backgroundColor: C.card }} />
  </Pressable>
);

export const Row = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>{children}</View>
);

const tightText: TextStyle | null = Platform.OS === "android" ? { includeFontPadding: false } : null;

/** 검색창 아래 결과 목록 — 칸이 넘치면 안에서 위아래로 스크롤합니다. 바깥 ScrollView 안에 있어도 굴러가도록 nestedScrollEnabled(안드로이드),
    키보드가 떠 있어도 첫 탭에 바로 골라지도록 keyboardShouldPersistTaps 를 켭니다. 줄은 이름 + 위치 두 줄만 담게 촘촘히. */
export function SearchResults<T>({
  items, keyOf, title, sub, onPick, onEndReached, maxHeight = 260, style,
}: {
  items: T[]; keyOf: (item: T, i: number) => string; title: (item: T) => string; sub?: (item: T) => string | null | undefined;
  onPick: (item: T) => void;
  /** 목록 끝 가까이까지 내리면 — 다음 쪽 결과를 불러올 때 씁니다. */
  onEndReached?: () => void;
  maxHeight?: number; style?: ViewStyle;
}) {
  return (
    <View style={[{ marginTop: 6, maxHeight, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, overflow: "hidden" }, SHADOW.card, style]}>
      <ScrollView
        nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={items.length > 4}
        scrollEventThrottle={100}
        onScroll={onEndReached && (({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 60) onEndReached();
        })}
      >
        {items.map((item, i) => {
          const line2 = sub?.(item);
          return (
            <Pressable
              key={keyOf(item, i)}
              onPress={() => onPick(item)}
              style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: i === items.length - 1 ? 0 : 1, borderBottomColor: C.line, backgroundColor: pressed ? C.lineSoft : undefined })}
            >
              <Text numberOfLines={1} style={[{ fontFamily: F.sansMd, fontSize: 13.5, lineHeight: 18, color: C.ink }, tightText]}>{title(item)}</Text>
              {!!line2 && <Text numberOfLines={1} style={[{ fontFamily: F.sans, fontSize: 11.5, lineHeight: 15, color: C.muted }, tightText]}>{line2}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
