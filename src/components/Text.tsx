/**
 * 앱 전체의 Text — react-native 의 Text 대신 이것을 씁니다.
 * 안드로이드는 글자 위아래에 글꼴 여백(includeFontPadding)을 덧붙이는데, 본문 글꼴(Noto Sans KR)은 키가 커서 그 여백이 크고 위아래가 고르지 않습니다.
 * 그래서 동그라미 · 배지 안의 숫자와 글자가 iOS 보다 아래로 처졌습니다. 여백을 꺼서 iOS 와 같은 높이로 그립니다.
 */
import type { ComponentProps } from "react";
import { Platform, Text as RNText, type TextStyle } from "react-native";

/** Animated.Text 처럼 이 Text 를 못 쓰는 곳에 직접 붙이는 같은 스타일. */
export const ANDROID_TEXT: TextStyle | null = Platform.OS === "android" ? { includeFontPadding: false } : null;

export function Text({ style, ...rest }: ComponentProps<typeof RNText>) {
  return <RNText {...rest} style={ANDROID_TEXT ? [ANDROID_TEXT, style] : style} />;
}
