import { useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import { showDialog } from "@/components/Dialog";
import { registerPushToken } from "./push";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { metersBetweenLL } from "@/lib/geo";
import { supabase } from "@/lib/supabase";
import { getUserItem, setUserItem } from "@/lib/userStore";
import { WISH_NEAR_M, type Wish } from "@/lib/types";
import { CHANNEL, ensureChannel } from "./channel";

/**
 * 담아둔 위시 50m 안에 들어오면 알림(핸드오프 §7).
 * iOS 는 상시 위치 대신 Region Monitoring(지오펜스)을 쓰고, 동시 감시 20개 제한이 있어
 * 좌표 있는 위시 중 가까운 20개만 등록합니다. 앱 실행·위시 변경 때 갱신합니다.
 */
const TASK = "dinary-wish-geofence";
const MAX_REGIONS = 20;
const SEP = "|";
const DISCLOSURE_KEY = "wish-background-location-consent:v1";

/** 근처 알림 안내에 「계속」을 누른 계정인지 — 계정마다 따로. 백그라운드에서도 저장된 세션으로 읽습니다. */
async function consented() {
  const uid = (await supabase.auth.getSession()).data.session?.user.id;
  return !!uid && (await getUserItem(uid, DISCLOSURE_KEY)) === "accepted";
}

// 이 파일을 앱 진입점(루트 레이아웃)에서 import 해야 백그라운드에서도 태스크가 정의됩니다.
TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(TASK, async ({ data, error }) => {
  if (error || !data) return;
  if (!(await consented().catch(() => false))) return;
  if (data.eventType !== Location.GeofencingEventType.Enter) return;
  const [wishId, ...rest] = (data.region.identifier ?? "").split(SEP);
  const name = rest.join(SEP);
  if (!wishId) return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${name || "담아둔 곳"}, 지금 앞에 계신가요?`,
      body: "눌러서 사진을 찍으면 방문이 인증됩니다.",
      data: { wishId },
    },
    trigger: { channelId: CHANNEL },
  });
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

/**
 * 「가고 싶은 곳 알림」을 켤 때만(위시 폼의 근처 알림 스위치 · 위시 카드의 종) 알림 · 위치(항상) 권한을 여쭙니다 — 앱 첫 실행이 아닙니다.
 * 이미 답했거나 다시 물을 수 없는 권한은 건너뛰어, 켤 때마다 창이 뜨지 않습니다.
 * Android 는 백그라운드 위치가 전경 권한과 분리된 두 번째 요청입니다.
 */
export async function askWishPermissions(): Promise<boolean> {
  try {
    if (await hasGeofencePermissions()) return true;
    const consent = await new Promise<boolean>((resolve) => showDialog(
      "근처 알림을 켤까요?",
      "DINARY는 앱을 닫았거나 사용하지 않을 때도 위치를 사용하여 담아둔 가게 근처(50m)에 도착하면 알려드립니다. 백그라운드 위치는 기기 안에서만 확인하며 서버로 보내지 않습니다. 선택 기능이며 거절해도 기록과 지도는 계속 쓸 수 있습니다." +
        (Platform.OS === "android" ? " 다음 위치 설정에서 ‘항상 허용’을 선택해 주세요." : " 위치 권한에서 ‘항상’을 허용해 주세요."),
      [{ text: "취소", style: "cancel", onPress: () => resolve(false) }, { text: "계속", onPress: () => resolve(true) }],
    ));
    if (!consent) return false;
    const uid = (await supabase.auth.getSession()).data.session?.user.id;
    if (!uid) return false;
    await setUserItem(uid, DISCLOSURE_KEY, "accepted");
    await ensureChannel();
    let n = await Notifications.getPermissionsAsync();
    if (!n.granted && n.canAskAgain) n = await Notifications.requestPermissionsAsync();
    if (!n.granted) return explainDenied();
    let fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted && fg.canAskAgain) fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return explainDenied();
    let bg = await Location.getBackgroundPermissionsAsync();
    if (!bg.granted && bg.canAskAgain) bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) return explainDenied();
    await registerPushToken();
    return true;
  } catch {
    showDialog("알림을 켜지 못했어요", "권한과 기기 설정을 확인한 뒤 다시 시도해 주세요.");
    return false;
  }
}

function explainDenied(): false {
  showDialog("근처 알림이 꺼져 있어요", "알림과 ‘항상’ 위치 권한이 모두 필요합니다. 설정에서 허용한 뒤 근처 알림을 다시 켜 주세요.", [
    { text: "닫기", style: "cancel" },
    { text: "설정 열기", onPress: () => { void Linking.openSettings().catch(() => {}); } },
  ]);
  return false;
}

async function hasGeofencePermissions() {
  if (!(await consented())) return false;
  const [n, fg, bg] = await Promise.all([
    Notifications.getPermissionsAsync(),
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return n.granted && fg.granted && bg.granted;
}

/** 알림을 켜 둔 위시 중 가까운 20곳을 감시 대상으로 등록합니다. 켜 둔 위시가 없으면 감시를 멈춥니다. */
async function syncWishGeofencesNow(wishes: Wish[]) {
  try {
    const targets = wishes.filter((w) => w.notify && w.lat != null && w.lng != null);
    const started = await Location.hasStartedGeofencingAsync(TASK).catch(() => false);

    if (!targets.length || !(await hasGeofencePermissions())) {
      if (started) await Location.stopGeofencingAsync(TASK);
      return;
    }

    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    const sorted = last
      ? [...targets].sort(
          (a, b) =>
            metersBetweenLL(last.coords.latitude, last.coords.longitude, a.lat!, a.lng!) -
            metersBetweenLL(last.coords.latitude, last.coords.longitude, b.lat!, b.lng!)
        )
      : targets;

    await Location.startGeofencingAsync(
      TASK,
      sorted.slice(0, MAX_REGIONS).map((w) => ({
        identifier: `${w.id}${SEP}${w.name}`,
        latitude: w.lat!,
        longitude: w.lng!,
        radius: WISH_NEAR_M,
        notifyOnEnter: true,
        notifyOnExit: false,
      }))
    );
  } catch (e) {
    console.warn("지오펜스 등록 실패", e);
  }
}

// Account changes and query updates must not race native registrations.
let geofenceSync: Promise<void> = Promise.resolve();
export function syncWishGeofences(wishes: Wish[]) {
  const job = geofenceSync.then(() => syncWishGeofencesNow(wishes));
  geofenceSync = job.catch(() => {});
  return job;
}

/** Refresh the actual OS state when a user returns from Settings. */
export function useWishPermissionState(enabled?: boolean) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let live = true;
    const check = () => { void hasGeofencePermissions().then((value) => { if (live) setAllowed(value); }, () => { if (live) setAllowed(false); }); };
    check();
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") check(); });
    return () => { live = false; sub.remove(); };
  }, [enabled]);
  return allowed;
}
