import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

/**
 * 원격 푸시 — 이 기기의 Expo 푸시 토큰을 내 계정에 등록합니다(push_tokens). 보내기는 Edge Function push-send.
 * 알림 권한이 있을 때만 등록하고, 권한은 여기서 묻지 않습니다(위시 · 보관함에 처음 담을 때 묻습니다).
 * 기기 설정에서 알림을 끄면 다음에 앱이 앞으로 올 때 서버의 토큰을 지웁니다(개인정보 처리방침 1조 자).
 * 안드로이드는 FCM 설정이 들어간 빌드부터 토큰이 나옵니다 — 그 전에는 조용히 건너뜁니다.
 */
const TOKEN_KEY = "push-token";
let lastToken: string | null = null;

export async function registerPushToken() {
  try {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    if (!(await Notifications.getPermissionsAsync()).granted) {
      await unregisterPushToken();
      return;
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    lastToken = token;
    await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
    await supabase.rpc("register_push_token", { p_token: token, p_platform: Platform.OS });
  } catch {
    // 시뮬레이터 · FCM 없는 안드로이드 빌드 · 오프라인 — 다음에 다시.
  }
}

/** 로그아웃 직전 · 알림 권한이 꺼졌을 때 — 이 기기로 (이전 계정의) 알림이 오지 않게. */
export async function unregisterPushToken() {
  const token = lastToken ?? (await AsyncStorage.getItem(TOKEN_KEY).catch(() => null));
  if (!token) return;
  const { error } = await supabase.rpc("unregister_push_token", { p_token: token }).then((r) => r, (e: unknown) => ({ error: e }));
  if (error) return; // 오프라인이면 다음에 다시
  lastToken = null;
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}

/** 콕 찌른 뒤 — 상대 기기로 바로 푸시. 실패해도 상대가 앱을 열면 알림이 뜹니다(usePokeInbox). */
export function pushPoke(recordId: number) {
  void supabase.functions.invoke("push-send", { body: { kind: "poke", recordId } }).catch(() => {});
}

/** 운영자 시험 — 내 기기들로 알림 견본 세 가지. */
export async function pushTest(): Promise<{ sent: number; tokens: number; errors: string[] }> {
  await registerPushToken();
  const { data, error } = await supabase.functions.invoke<{ sent: number; tokens: number; errors: string[] }>("push-send", { body: { kind: "test" } });
  if (error) throw new Error(error.message);
  return data ?? { sent: 0, tokens: 0, errors: [] };
}

/** 운영자 — 앱 전체 공지 한 건을 등록된 모든 기기에 푸시로. 서버가 공지마다 한 번만 보냅니다. */
export async function pushNotice(noticeId: number): Promise<{ sent: number; tokens: number; errors: string[] }> {
  const { data, error } = await supabase.functions.invoke<{ sent: number; tokens: number; errors: string[] }>("push-send", { body: { kind: "notice", noticeId } });
  if (error) throw new Error(error.message);
  return data ?? { sent: 0, tokens: 0, errors: [] };
}
