/**
 * 키보드가 내려가면 입력칸도 놓습니다. 안드로이드는 뒤로 가기 · 키보드 내리기 키로 키보드만 내리고
 * 포커스는 남겨 두어, 포커스에 묶인 검색 목록이 그대로 떠 있었습니다.
 */
import { useEffect, useState, type RefObject } from "react";
import { Keyboard, LayoutAnimation, Platform, type KeyboardEvent, type TextInput } from "react-native";

export function useBlurOnKeyboardHide(input: RefObject<TextInput | null>) {
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => input.current?.blur());
    return () => sub.remove();
  }, [input]);
}

/**
 * iOS 키보드 높이 — 아래에서 올라오는 모달 시트를 그만큼 띄울 때 씁니다(active 일 때만 듣습니다).
 * 모달 안의 KeyboardAvoidingView 는 iOS 에서 자리를 못 재 시트가 올라가지 않았습니다. iOS 는 창이 줄지 않으니 키보드 높이 그대로면 됩니다.
 * 안드로이드는 늘 0 — 그쪽은 KeyboardAvoidingView 가 맡습니다.
 */
export function useIosKeyboardHeight(active = true) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "ios" || !active) return;
    const move = (e: KeyboardEvent, h: number) => {
      const duration = Math.max(e.duration || 0, 10);
      LayoutAnimation.configureNext({ duration, update: { duration, type: LayoutAnimation.Types.keyboard } });
      setHeight(h);
    };
    const subs = [
      Keyboard.addListener("keyboardWillShow", (e) => move(e, e.endCoordinates.height)),
      Keyboard.addListener("keyboardWillHide", (e) => move(e, 0)),
    ];
    return () => { subs.forEach((s) => s.remove()); setHeight(0); };
  }, [active]);
  return height;
}

/** 키보드가 떠 있는지 — 시트 아래 여백(홈 표시줄 몫)을 키보드가 있을 땐 줄일 때 씁니다. iOS 는 will, 안드로이드는 did 이벤트. */
export function useKeyboardOpen(active = true) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active) return;
    const [show, hide] = Platform.OS === "ios" ? (["keyboardWillShow", "keyboardWillHide"] as const) : (["keyboardDidShow", "keyboardDidHide"] as const);
    const subs = [Keyboard.addListener(show, () => setOpen(true)), Keyboard.addListener(hide, () => setOpen(false))];
    return () => { subs.forEach((s) => s.remove()); setOpen(false); };
  }, [active]);
  return open;
}
