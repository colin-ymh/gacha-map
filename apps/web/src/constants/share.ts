// 공유 링크가 가리키는 정식 웹 오리진.
// 빌드 프로필에 따라 값이 바뀌면 이미 배포된 링크와 OG 정규 URL이 어긋나므로,
// 환경변수로 덮되 기본값은 production 도메인으로 고정한다.
export const SHARE_SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://the-gacha-map.vercel.app";

export const APP_STORE_URL = "https://apps.apple.com/app/id6772389763";
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.gachamap.app";

// 인스타그램 인앱 브라우저(WKWebView)는 https apps.apple.com 유니버설 링크를
// 네이티브 App Store로 넘기지 못하고 빈 화면을 띄우는 경우가 있다.
// itms-apps 스킴은 OS가 직접 처리하므로 웹뷰 안에서도 스토어가 열린다.
export const APP_STORE_SCHEME_URL =
  "itms-apps://apps.apple.com/app/id6772389763";

// Android 정식 출시 전까지 안드로이드 유입은 베타테스터 모집 폼으로 보낸다.
// PLAY_STORE_RELEASED를 true로 바꾸면 이 폼 대신 Play 스토어로 이동한다.
export const ANDROID_BETA_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfE-ytILotdkjgqDHx3ffwoecxPpAiRx7NhTJgP2KFtzqKY7w/viewform";

// Play 스토어는 아직 internal test track이라 공개 URL이 404다.
// 정식 출시 후 true로 바꾸면 랜딩의 Play 배지가 활성화된다.
export const PLAY_STORE_RELEASED = false;
