// 공유 링크가 가리키는 정식 웹 오리진.
// 빌드 프로필에 따라 값이 바뀌면 이미 배포된 링크와 OG 정규 URL이 어긋나므로,
// 환경변수로 덮되 기본값은 production 도메인으로 고정한다.
export const SHARE_SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://the-gacha-map.vercel.app";

export const APP_STORE_URL = "https://apps.apple.com/app/id6772389763";
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.gachamap.app";

// Play 스토어는 아직 internal test track이라 공개 URL이 404다.
// 정식 출시 후 true로 바꾸면 랜딩의 Play 배지가 활성화된다.
export const PLAY_STORE_RELEASED = false;
