import * as Updates from "expo-updates";
import { useEffect, useState } from "react";

/** 처음 설치하고 연 앱(빌드에 든 JS)이 더 새 업데이트를 기다릴 최대 시간. 넘기면 그냥 열고, 받은 건 다음 실행에. */
export const FIRST_LAUNCH_UPDATE_MS = 5000;

/**
 * 빌드에 든 JS로 열렸을 때만(새로 설치 · 아직 업데이트를 한 번도 못 받음) 스플래시를 띄운 채 새 업데이트를 확인하고,
 * 있으면 받아서 바로 다시 엽니다 — 새 베타 테스터가 첫 실행 튜토리얼을 옛 JS로 보지 않게.
 * 업데이트를 한 번 받은 뒤 · 개발 빌드 · 오프라인 · 실패 · 시간 초과면 기다리지 않습니다. true 가 되면 화면을 그려도 됩니다.
 */
export function useFirstLaunchUpdate(): boolean {
  const [done, setDone] = useState(() => __DEV__ || !Updates.isEnabled || !Updates.isEmbeddedLaunch);
  useEffect(() => {
    if (done) return;
    let shown = false;
    const finish = () => { shown = true; setDone(true); };
    const timer = setTimeout(finish, FIRST_LAUNCH_UPDATE_MS);
    void (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable || shown) return finish();
        const fetched = await Updates.fetchUpdateAsync();
        // 시간을 넘겨 이미 화면을 그렸으면 다시 열지 않습니다(받은 업데이트는 다음 실행에 씀).
        if (fetched.isNew && !shown) { await Updates.reloadAsync(); return; }
      } catch {
        // 오프라인 · 서버 오류 · 자동 확인과 겹침 — 그냥 엽니다.
      }
      finish();
    })();
    return () => clearTimeout(timer);
  }, [done]);
  return done;
}
