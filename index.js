// Android 홈 화면 위젯은 앱이 꺼져 있어도 헤드리스 JS 태스크로 그립니다 — 그 태스크를 라우터보다 먼저 등록합니다.
// 위젯 모듈이 없는 옛 빌드(OTA 로 이 코드만 받은 경우)에서는 건너뜁니다.
import { Platform } from "react-native";

if (Platform.OS === "android") {
  try {
    require("./src/features/widget/android").registerAndroidWidgets();
  } catch (e) {
    console.warn("위젯 등록 건너뜀", e);
  }
}

require("expo-router/entry");
