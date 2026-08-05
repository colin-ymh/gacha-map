// 공유 링크가 가리키는 웹 오리진.
//
// EXPO_PUBLIC_API_URL을 쓰면 안 된다 — dev 빌드 프로필에서 http://localhost:3000이라
// 공유받은 사람이 열 수 없는 링크가 나간다. 공유 링크는 빌드 프로필과 무관하게
// 항상 production 웹을 가리켜야 한다.
export const SHARE_WEB_ORIGIN = "https://the-gacha-map.vercel.app";

// 웹 next-intl routing에 정의된 로케일. 앱 언어가 여기에 없으면 기본값으로 떨어진다.
export const SHARE_LOCALES = ["ko", "en", "ja", "zh"];

// 인스타그램 스토리 공유에 필요한 Facebook App ID (developers.facebook.com에서 발급).
// Meta가 정한 방식이라 우회할 수 없다 — iOS는 instagram-stories://share?source_application=<ID>.
//
// 비어 있으면 인스타 경로 전체가 꺼진다(선택지도, 캡처용 카드 마운트도).
// 런타임 파라미터라서 값이 생겨도 재빌드는 필요 없다.
export const INSTAGRAM_APP_ID = "1262308689253196";

export const INSTAGRAM_ANDROID_PACKAGE = "com.instagram.android";
export const INSTAGRAM_STORIES_SCHEME = "instagram-stories://";
