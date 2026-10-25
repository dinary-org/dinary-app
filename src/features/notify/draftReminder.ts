import { registerPushToken } from "./push";
import * as Notifications from "expo-notifications";
import { todayIso } from "@/lib/anniversary";
import type { Restaurant } from "@/lib/types";
import { CHANNEL, ensureChannel } from "./channel";

/**
 * 보관함 알림 — 오늘 사진으로 인증하고 «나중에 쓸게요»로 담아 둔 기록이 있으면 오늘 21시에 한 번 알려 줍니다.
 * 기기 안에서 예약하는 알림이라, 기록 목록이 바뀔 때마다 지우고 다시 맞춥니다(다 쓰면 예약도 사라짐).
 * 21시가 지난 뒤 담은 기록은 그날 알리지 않습니다.
 */
const ID = "dinary-draft-reminder";
const HOUR = 21;

export async function syncDraftReminder(rows: Restaurant[], nickname: string | null) {
  try {
    await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
    const drafts = rows.filter((r) => r.pending);
    const today = todayIso();
    if (!drafts.some((r) => r.verified && r.visited_at === today)) return;
    const at = new Date();
    at.setHours(HOUR, 0, 0, 0);
    if (at.getTime() <= Date.now()) return;
    await ensureChannel();
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: {
        title: "기록을 완성해보는 거 어때요?",
        body: `${nickname ? `${nickname}님이 ` : ""}아직 완성하지 않은 기록이 ${drafts.length}개 있어요.`,
        data: { drafts: true },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  } catch (e) {
    console.warn("보관함 알림 예약 실패", e);
  }
}

export const clearDraftReminder = () => Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});

/** «나중에 쓸게요»로 처음 담을 때 알림 권한을 여쭙니다 — 이미 답했으면 다시 묻지 않습니다. */
export async function askDraftReminderPermission() {
  await ensureChannel();
  const now = await Notifications.getPermissionsAsync().catch(() => null);
  if (now && !now.granted && now.canAskAgain) await Notifications.requestPermissionsAsync().catch(() => {});
  await registerPushToken();
}
