// 공유 링크가 가리키는 웹 오리진.
//
// EXPO_PUBLIC_API_URL을 쓰면 안 된다 — dev 빌드 프로필에서 http://localhost:3000이라
// 공유받은 사람이 열 수 없는 링크가 나간다. 공유 링크는 빌드 프로필과 무관하게
// 항상 production 웹을 가리켜야 한다.
export const SHARE_WEB_ORIGIN = "https://the-gacha-map.vercel.app";

// 웹 next-intl routing에 정의된 로케일. 앱 언어가 여기에 없으면 기본값으로 떨어진다.
export const SHARE_LOCALES = ["ko", "en", "ja", "zh"];
