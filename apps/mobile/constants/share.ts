const PROD_SHARE_ORIGIN = "https://the-gacha-map.vercel.app";

// 공유 링크가 가리키는 웹 오리진.
//
// EXPO_PUBLIC_API_URL을 그대로 쓰면 안 된다 — development 프로필의
// http://localhost:3000처럼 공유받은 사람이 못 여는 주소가 나갈 수 있다.
// 대신 "남도 열 수 있는 진짜 https 주소"일 때만(예: preview 프로필의
// gacha-map-git-develop-gachamap.vercel.app) 그대로 쓰고, localhost나
// LAN IP처럼 로컬 전용 주소면 production으로 폴백한다. 이렇게 해야
// preview(dev) 빌드에서도 실제 공유 → 클릭 → 보너스 적립을 dev DB 기준으로
// 끝까지 테스트할 수 있다 (기존엔 무조건 prod로 나가서 dev 계정으로는
// 절대 검증이 안 됐음).
function resolveShareOrigin(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) return PROD_SHARE_ORIGIN;

  try {
    const parsed = new URL(apiUrl);
    const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname);
    if (
      parsed.protocol === "https:" &&
      parsed.hostname !== "localhost" &&
      !isIpLiteral
    ) {
      return apiUrl.replace(/\/$/, "");
    }
  } catch {
    // EXPO_PUBLIC_API_URL이 유효한 URL이 아니면 무시하고 prod로 폴백
  }
  return PROD_SHARE_ORIGIN;
}

export const SHARE_WEB_ORIGIN = resolveShareOrigin();

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
