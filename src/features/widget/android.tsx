import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FlexWidget,
  ImageWidget,
  OverlapWidget,
  registerWidgetTaskHandler,
  requestWidgetUpdate,
  SvgWidget,
  TextWidget,
  type ColorProp,
  type WidgetInfo,
  type WidgetTaskHandler,
} from "react-native-android-widget";

/**
 * Android 홈 화면 위젯 — iOS(targets/widget/*.swift)와 같은 넷: 「바로 촬영」 + 「이번 달 인증」 3종(4a 숫자 · 3a 도장 달력 · 3c 마지막 사진).
 * 위젯은 앱이 꺼져 있어도 헤드리스 JS 태스크로 그리므로, 값은 앱이 AsyncStorage 에 써 두고(src/lib/widget.ts) 여기서 읽습니다.
 * 네이티브 모듈이 없는 옛 빌드에서는 이 파일을 불러오는 순간 오류가 나니 늘 try 안에서 require 합니다.
 */

export type MonthData = {
  /** "YYYY-MM"(한국 시간) */
  month: string;
  count: number;
  /** 인증한 날(일) */
  days: number[];
  lastName: string;
  /** "MM.DD" */
  lastAt: string;
  /** 360px JPEG base64 */
  lastPhoto: string;
};

const KEY = "android-month-widget";
export const MONTH_WIDGETS = ["MonthWidget", "MonthDotsWidget", "MonthPhotoWidget"] as const;

// MARK: 색 · 글꼴 — MonthWidgets.swift 와 같은 값

const brick = "#b4552d", paper = "#ffffff", ink = "#1c1a17";
const line = "#ece9e5", mute = "#8a8377", sub = "#6b665e", faint = "#d1cdc6", blush = "#f1d9cc";
const dayPast = "#ece9e5", dayAhead = "#f3f1ee";
const BATANG = "GowunBatang-Regular", BATANG_B = "GowunBatang-Bold", MONO = "JetBrainsMono-Regular";
/** 런처가 모서리를 깎지 않는 기기에서도 iOS 위젯처럼 둥글게 */
const R = 20;
const open = (uri: string) => ({ clickAction: "OPEN_URI", clickActionData: { uri } });
const captureLink = open("dinary://capture");
const calendarLink = open("dinary://calendar");

/** 앱의 CameraIcon(24×24 선 아이콘)과 같은 모양 */
const cameraSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">` +
  `<rect x="2.5" y="5.5" width="19" height="14" rx="3.5"/><circle cx="12" cy="12.5" r="4"/><path d="M8 5.5 9.4 3h5.2L16 5.5"/></svg>`;

// MARK: 데이터

/** 한국 시간 기준 지금 — 연 · 월 · 일 · 그 달 1일의 요일(일요일 0) · 그 달 날 수 */
function kstNow() {
  const d = new Date(Date.now() + 9 * 3600e3);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  return {
    ym: `${y}-${String(m + 1).padStart(2, "0")}`,
    month: m + 1,
    today: d.getUTCDate(),
    lead: new Date(Date.UTC(y, m, 1)).getUTCDay(),
    days: new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
  };
}

type Entry = Omit<MonthData, "month"> & { month: number; today: number; lead: number; monthDays: number; empty: boolean };

async function entry(): Promise<Entry> {
  const now = kstNow();
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  let d: MonthData | null = null;
  try { d = raw ? (JSON.parse(raw) as MonthData) : null; } catch {}
  // 저장된 달이 지금 달과 다르면(새 달) 0
  const v = d?.month === now.ym ? d : null;
  const count = v?.count ?? 0;
  return {
    month: now.month, today: now.today, lead: now.lead, monthDays: now.days,
    count, days: v?.days ?? [], lastName: v?.lastName ?? "", lastAt: v?.lastAt ?? "", lastPhoto: v?.lastPhoto ?? "",
    empty: count === 0,
  };
}

// MARK: 바로 촬영

function CaptureView() {
  return (
    <FlexWidget
      {...captureLink}
      accessibilityLabel="바로 촬영"
      style={{ width: "match_parent", height: "match_parent", backgroundColor: brick, borderRadius: R, padding: 16, flexDirection: "column", justifyContent: "space-between" }}
    >
      <TextWidget text="DINARY" style={{ fontSize: 12, fontWeight: "bold", letterSpacing: 0.12, color: "rgba(255, 255, 255, 0.75)" }} />
      <SvgWidget svg={cameraSvg(paper)} style={{ width: 44, height: 44 }} />
      <TextWidget text="바로 촬영" style={{ fontSize: 17, fontWeight: "bold", color: paper }} />
    </FlexWidget>
  );
}

// MARK: 4a

const Spacer = () => <FlexWidget style={{ flex: 1 }} />;

function MonthView({ e }: { e: Entry }) {
  return (
    <FlexWidget
      {...calendarLink}
      style={{ width: "match_parent", height: "match_parent", backgroundColor: paper, borderRadius: R, paddingVertical: 15, paddingHorizontal: 16, flexDirection: "column" }}
    >
      <TextWidget text={`${e.month}월의 인증`} style={{ fontFamily: BATANG_B, fontSize: 13, color: ink }} />
      <Spacer />
      <TextWidget text={`${e.count}`} allowFontScaling={false} style={{ fontFamily: BATANG, fontSize: 62, color: e.empty ? faint : brick }} />
      <Spacer />
      <FlexWidget style={{ width: "match_parent", height: 1, backgroundColor: line }} />
      <TextWidget
        text={e.empty ? "아직 없어요" : e.lastName}
        maxLines={1}
        truncate="END"
        style={{ marginTop: 8, fontFamily: BATANG_B, fontSize: 13, color: ink }}
      />
      <TextWidget text={e.empty ? "첫 식사를 찍어 보세요" : `✓ ${e.lastAt}`} style={{ marginTop: 3, fontFamily: MONO, fontSize: 9.5, color: e.empty ? mute : brick }} />
    </FlexWidget>
  );
}

// MARK: 3a

function MonthDotsView({ e }: { e: Entry }) {
  // 일요일 시작 칸. 0 = 달 밖.
  const total = Math.ceil((e.lead + e.monthDays) / 7) * 7;
  const cells = Array.from({ length: total }, (_, i) => (i < e.lead || i - e.lead >= e.monthDays ? 0 : i - e.lead + 1));
  const six = cells.length > 35;
  const s = six ? 11 : 12;
  // 오늘 인증 고리가 들어가게 칸을 4 크게 잡고 줄 간격에서 그만큼 뺍니다.
  const cell = s + 4;
  const gap = (six ? 4 : 5) - 4;
  const on = new Set(e.days);

  const dot = (d: number, key: number) => {
    const box = { width: cell, height: cell, alignItems: "center", justifyContent: "center" } as const;
    const circle = (size: number, color: ColorProp) => <FlexWidget style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
    if (d === 0) return <FlexWidget key={key} style={box} />;
    if (on.has(d) && d === e.today) {
      // 오늘 인증: 채운 점 + paper · brick 바깥 고리
      return (
        <FlexWidget key={key} style={{ ...box, borderRadius: cell / 2, borderWidth: 1.5, borderColor: brick, backgroundColor: paper }}>
          {circle(s - 1, brick)}
        </FlexWidget>
      );
    }
    if (on.has(d)) return <FlexWidget key={key} style={box}>{circle(s, brick)}</FlexWidget>;
    if (d === e.today) {
      return (
        <FlexWidget key={key} style={box}>
          <FlexWidget style={{ width: s, height: s, borderRadius: s / 2, borderWidth: 1.5, borderColor: brick }} />
        </FlexWidget>
      );
    }
    return <FlexWidget key={key} style={box}>{circle(s, d < e.today ? dayPast : dayAhead)}</FlexWidget>;
  };

  return (
    <FlexWidget
      {...calendarLink}
      style={{ width: "match_parent", height: "match_parent", backgroundColor: paper, borderRadius: R, paddingVertical: 15, paddingHorizontal: 14, flexDirection: "column" }}
    >
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", paddingHorizontal: 2 }}>
        <TextWidget text={`${e.month}월`} style={{ fontFamily: BATANG_B, fontSize: 15, color: ink }} />
        <Spacer />
        <TextWidget text={`${e.count}`} style={{ fontFamily: MONO, fontSize: 11, color: e.empty ? mute : brick }} />
      </FlexWidget>
      <Spacer />
      <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: gap }}>
        {Array.from({ length: total / 7 }, (_, row) => (
          <FlexWidget key={row} style={{ width: "match_parent", flexDirection: "row", justifyContent: "space-between" }}>
            {cells.slice(row * 7, row * 7 + 7).map((d, col) => dot(d, col))}
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}

// MARK: 3c

function MonthPhotoView({ e, width, height }: { e: Entry; width: number; height: number }) {
  const photo = e.empty ? "" : e.lastPhoto;
  return (
    <OverlapWidget {...calendarLink} style={{ width: "match_parent", height: "match_parent", backgroundColor: brick, borderRadius: R, overflow: "hidden" }}>
      {photo ? (
        <ImageWidget image={`data:image/jpeg;base64,${photo}`} imageWidth={width} imageHeight={height} resizeMode="cover" radius={R} />
      ) : null}
      {photo ? (
        // 글자가 읽히게 사진 위에만 아래로 어두워지는 그라데이션(위 40% 는 그대로)
        <FlexWidget style={{ width: "match_parent", height: "match_parent", flexDirection: "column" }}>
          <FlexWidget style={{ flex: 4 }} />
          <FlexWidget
            style={{ flex: 6, width: "match_parent", borderBottomLeftRadius: R, borderBottomRightRadius: R, backgroundGradient: { from: "rgba(28, 26, 23, 0)", to: "rgba(28, 26, 23, 0.72)", orientation: "TOP_BOTTOM" } }}
          />
        </FlexWidget>
      ) : null}
      <FlexWidget style={{ width: "match_parent", height: "match_parent", padding: 12, flexDirection: "column" }}>
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", backgroundColor: paper, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8 }}>
          <TextWidget text={`${e.count}`} style={{ fontFamily: BATANG_B, fontSize: 15, color: brick }} />
          <TextWidget text={`${e.month}월`} style={{ marginLeft: 3, fontFamily: MONO, fontSize: 9, color: sub }} />
        </FlexWidget>
        <Spacer />
        <TextWidget
          text={e.empty ? "아직 없어요" : e.lastName}
          maxLines={1}
          truncate="END"
          style={{ marginHorizontal: 2, fontFamily: BATANG_B, fontSize: 14, color: paper }}
        />
        <TextWidget text={e.empty ? "첫 식사를 찍어 보세요" : `✓ ${e.lastAt}`} style={{ marginTop: 2, marginHorizontal: 2, fontFamily: MONO, fontSize: 9.5, color: blush }} />
      </FlexWidget>
    </OverlapWidget>
  );
}

// MARK: 그리기

async function render(info: WidgetInfo) {
  if (info.widgetName === "CaptureWidget") return <CaptureView />;
  const e = await entry();
  if (info.widgetName === "MonthDotsWidget") return <MonthDotsView e={e} />;
  if (info.widgetName === "MonthPhotoWidget") return <MonthPhotoView e={e} width={info.width} height={info.height} />;
  return <MonthView e={e} />;
}

/** 위젯을 놓을 때 · 크기를 바꿀 때 · 정해 둔 주기(1시간 — 날짜 · 새 달)마다 앱이 꺼져 있어도 불립니다. */
const handler: WidgetTaskHandler = async ({ widgetInfo, widgetAction, renderWidget }) => {
  if (widgetAction === "WIDGET_DELETED" || widgetAction === "WIDGET_CLICK") return;
  renderWidget(await render(widgetInfo));
};

/** 앱 진입점(index.js)에서 한 번 — 라우터보다 먼저 등록해야 헤드리스로 깨어났을 때도 찾습니다. */
export function registerAndroidWidgets() {
  registerWidgetTaskHandler(handler);
}

/** 앱이 값을 새로 쓰고 홈 화면에 놓인 「이번 달 인증」 위젯들을 바로 다시 그립니다. */
export async function saveMonthWidgets(data: MonthData) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
  await Promise.all(MONTH_WIDGETS.map((widgetName) => requestWidgetUpdate({ widgetName, renderWidget: render })));
}
