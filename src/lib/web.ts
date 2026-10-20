/**
 * 앱 밖 웹 페이지(개인정보 처리방침 · 이용약관 · 공유 링크)의 주소.
 * 저장소의 site/ 폴더를 GitHub Pages 로 내보냅니다(.github/workflows/pages.yml).
 * 다른 주소(자체 도메인 등)로 옮기면 EXPO_PUBLIC_WEB_BASE_URL 만 바꾸면 됩니다.
 */
export const WEB_BASE = (process.env.EXPO_PUBLIC_WEB_BASE_URL || "https://dinary-org.github.io/dinary-app").replace(/\/+$/, "");

export const PRIVACY_URL = `${WEB_BASE}/privacy/`;
export const TERMS_URL = `${WEB_BASE}/terms/`;
