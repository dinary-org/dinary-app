/**
 * 키보드가 내려가면 입력칸도 놓습니다. 안드로이드는 뒤로 가기 · 키보드 내리기 키로 키보드만 내리고
 * 포커스는 남겨 두어, 포커스에 묶인 검색 목록이 그대로 떠 있었습니다.
 */
import { useEffect, type RefObject } from "react";
import { Keyboard, type TextInput } from "react-native";

export function useBlurOnKeyboardHide(input: RefObject<TextInput | null>) {
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => input.current?.blur());
    return () => sub.remove();
  }, [input]);
}
