import { ExtensionStorage } from "@bacons/apple-targets";
import { File, Paths } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";
import { verifiedOnly } from "./recommend";
import { PHOTO_BUCKET, photoPath } from "./signedPhoto";
import { supabase } from "./supabase";
import { coverPhoto, type Restaurant } from "./types";

/**
 * 홈 화면 「이번 달 인증」 위젯 3종에 넘길 값.
 * iOS(targets/widget/MonthWidgets.swift): App Group UserDefaults 에 써 두면 위젯이 읽습니다. 네이티브 모듈이 없는 옛 빌드에서는 ExtensionStorage 가 아무 일도 하지 않습니다.
 * Android(src/features/widget/android.tsx): 한 덩어리로 AsyncStorage 에 써 두고 위젯을 다시 그립니다.
 */
const store = new ExtensionStorage("group.app.dinary");
const KINDS = ["MonthWidget", "MonthDotsWidget", "MonthPhotoWidget"];

type AndroidWidgets = typeof import("@/features/widget/android");
/** 위젯 모듈이 없는 옛 Android 빌드(OTA 로 이 코드만 받은 경우)에서는 불러오다 오류가 나니 null — 아무 일도 하지 않습니다. */
function androidWidgets(): AndroidWidgets | null {
  try {
    return require("@/features/widget/android") as AndroidWidgets;
  } catch {
    return null;
  }
}

/** 한국 시간 "YYYY-MM-DD" */
const kstDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10);

/** 위젯에 실제로 써 둔 사진의 원본 값 — 같은 사진이면 다시 만들지 않습니다. */
let writtenSrc = "";
/** 그 사진(base64) — Android 는 값을 한 덩어리로 다시 쓰므로 들고 있습니다. */
let writtenPhoto = "";
/** 늦게 끝난 앞선 동기화가 새 사진을 덮어쓰지 않게 — 마지막으로 부른 것만 사진을 씁니다. */
let seq = 0;

/** 대표사진(비공개 버킷) → 서명 주소로 받아 360px JPEG base64. 실패하면 "". */
async function photoBase64(ref: string): Promise<string> {
  const path = photoPath(ref);
  let url = ref;
  if (path) {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60);
    if (error) return "";
    url = data.signedUrl;
  }
  const file = await File.downloadFileAsync(url, new File(Paths.cache, `widget-cover-${Date.now()}.jpg`), { idempotent: true });
  try {
    const out = await ImageManipulator.manipulateAsync(file.uri, [{ resize: { width: 360 } }], {
      compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true,
    });
    return out.base64 ?? "";
  } finally {
    try { file.delete(); } catch {}
  }
}

/** 개인 기록장의 기록으로 위젯을 새로 씁니다 — 기록 목록을 새로 받을 때마다(저장 · 삭제 뒤 포함) 부릅니다. */
export async function syncMonthWidget(rows: Restaurant[]) {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  const android = Platform.OS === "android" ? androidWidgets() : null;
  if (Platform.OS === "android" && !android) return;
  const my = ++seq;
  const month = kstDate(new Date().toISOString()).slice(0, 7);
  const mine = verifiedOnly(rows)
    .filter((r) => kstDate(r.verified_at!).startsWith(month))
    .sort((a, b) => (a.verified_at! < b.verified_at! ? 1 : -1));
  const last = mine[0];
  // 3a — 인증한 날(한국 시간 일)
  const days = [...new Set(mine.map((r) => Number(kstDate(r.verified_at!).slice(8, 10))))];
  const lastName = last?.name ?? "";
  // 위젯에서 시각을 다시 풀지 않게 「MM.DD」로 넘깁니다.
  const lastAt = last ? kstDate(last.verified_at!).slice(5).replace("-", ".") : "";

  if (!android) {
    store.set("month", month);
    store.set("count", mine.length);
    store.set("days", days.join(","));
    store.set("lastName", lastName);
    store.set("lastAt", lastAt);
  }

  // 3c — 마지막 인증 기록의 대표사진
  const src = last ? coverPhoto(last) ?? "" : "";
  if (src !== writtenSrc) {
    const b64 = src ? await photoBase64(src).catch(() => "") : "";
    if (my !== seq) return;
    if (!android) store.set("lastPhoto", b64);
    writtenPhoto = b64;
    writtenSrc = b64 ? src : ""; // 실패하면 다음 동기화 때 다시
  }
  if (android) {
    await android.saveMonthWidgets({ month, count: mine.length, days, lastName, lastAt, lastPhoto: writtenPhoto }).catch((e) => console.warn("위젯 갱신 실패", e));
    return;
  }
  KINDS.forEach((k) => ExtensionStorage.reloadWidget(k));
}

/** 로그아웃 · 탈퇴 — 다른 사람 기록이 위젯에 남지 않게 비웁니다. */
export function clearMonthWidget() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  seq++;
  writtenSrc = "";
  writtenPhoto = "";
  if (Platform.OS === "android") {
    void androidWidgets()
      ?.saveMonthWidgets({ month: "", count: 0, days: [], lastName: "", lastAt: "", lastPhoto: "" })
      .catch(() => {});
    return;
  }
  ["month", "days", "lastName", "lastAt", "lastPhoto"].forEach((k) => store.set(k, ""));
  store.set("count", 0);
  KINDS.forEach((k) => ExtensionStorage.reloadWidget(k));
}
