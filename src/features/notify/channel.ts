import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Android 알림 채널 — 8.0 부터는 채널이 있어야 알림이 뜨고, 13 부터는 채널이 하나라도 있어야
 * 알림 권한 창이 뜹니다(없으면 requestPermissionsAsync 가 아무것도 묻지 않고 끝남).
 * 권한을 여쭙거나 알림을 예약하기 전에 늘 await 합니다. iOS 에서는 아무 일도 하지 않습니다.
 */
export const CHANNEL = "dinary";

let ready: Promise<void> | null = null;

export function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();
  return (ready ??= Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "DINARY 알림",
    // iOS 배너처럼 화면 위로 내려오게
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#b4552d",
  }).then(
    () => {},
    (e) => {
      ready = null;
      console.warn("알림 채널 만들기 실패", e);
    }
  ));
}

// 앱을 열자마자 만들어 둡니다 — 시스템 설정의 알림 항목에도 바로 보입니다.
void ensureChannel();
