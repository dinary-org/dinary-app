import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { metersBetweenLL } from "@/lib/geo";
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

// 이 파일을 앱 진입점(루트 레이아웃)에서 import 해야 백그라운드에서도 태스크가 정의됩니다.
TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(TASK, async ({ data, error }) => {
  if (error || !data) return;
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
  await ensureChannel();
  const n = await Notifications.getPermissionsAsync();
  if (!n.granted && n.canAskAgain) await Notifications.requestPermissionsAsync();
  let fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted && fg.canAskAgain) fg = await Location.requestForegroundPermissionsAsync();
  if (fg.granted) {
    const bg = await Location.getBackgroundPermissionsAsync();
    if (!bg.granted && bg.canAskAgain) await Location.requestBackgroundPermissionsAsync();
  }
  return hasGeofencePermissions();
}

async function hasGeofencePermissions() {
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
