const { withAndroidManifest } = require("expo/config-plugins");

/**
 * expo-location 라이브러리 매니페스트가 LocationTaskService(foregroundServiceType="location")를 늘 넣습니다.
 * 근처 알림은 지오펜스(PendingIntent 브로드캐스트)라 이 서비스를 쓰지 않는데, Play 는 선언만 보고 FGS 위치 선언을 요구합니다.
 * 병합 매니페스트에서 tools:node="remove" 로 뺍니다. startLocationUpdatesAsync 를 쓰게 되면 이 플러그인을 지우세요.
 */
const SERVICE = "expo.modules.location.services.LocationTaskService";

module.exports = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    const app = manifest.application[0];
    app.service = (app.service ?? []).filter((s) => s.$["android:name"] !== SERVICE);
    app.service.push({ $: { "android:name": SERVICE, "tools:node": "remove" } });
    return cfg;
  });
