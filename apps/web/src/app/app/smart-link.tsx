"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  APP_STORE_URL,
  APP_STORE_SCHEME_URL,
  APP_STORE_SAFARI_URL,
  PLAY_STORE_URL,
  PLAY_STORE_RELEASED,
  ANDROID_BETA_FORM_URL,
} from "@/constants/share";
import { CtaGroup, Caption, StoreButton, SecondaryButton } from "./styles";

type Platform = "ios" | "android" | "unknown";

interface Client {
  platform: Platform;
  inApp: boolean;
}

const SERVER_CLIENT: Client = { platform: "unknown", inApp: false };

// UA는 세션 중 바뀌지 않으므로 구독할 대상이 없다. 정리 함수만 반환한다.
const subscribeToNothing = () => () => {};

// useSyncExternalStore는 스냅샷이 매번 같은 참조여야 무한 렌더를 피한다.
let cachedClient: Client | null = null;

function detectClient(): Client {
  if (cachedClient) return cachedClient;

  const ua = navigator.userAgent;

  let platform: Platform = "unknown";
  // iPadOS 13+는 데스크톱 Safari UA를 쓰므로 터치 포인트로 보정한다.
  if (/iPhone|iPad|iPod/i.test(ua)) platform = "ios";
  else if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
    platform = "ios";
  else if (/Android/i.test(ua)) platform = "android";

  // 인스타/페북/카톡/라인/네이버 등 앱 내장 웹뷰. 이들은 apps.apple.com 이동을
  // 조용히 취소하므로 일반 브라우저와 다른 링크를 줘야 한다.
  const inApp =
    /Instagram|FBAN|FBAV|FB_IAB|KAKAOTALK|Line\/|NAVER|DaumApps|Threads/i.test(
      ua,
    );

  cachedClient = { platform, inApp };
  return cachedClient;
}

const getServerClient = (): Client => SERVER_CLIENT;

const ANDROID_TARGET = PLAY_STORE_RELEASED
  ? PLAY_STORE_URL
  : ANDROID_BETA_FORM_URL;

/**
 * 인스타그램 프로필 바이오용 스마트 링크.
 *
 * 인스타 인앱 브라우저(WKWebView)는 apps.apple.com https 링크를 네이티브
 * App Store로 넘기지 못한다. 흰 화면이 뜨거나 탭해도 아무 일도 일어나지 않는다.
 * 프로그래매틱 스킴 이동(window.location = "itms-apps://")도 조용히 취소된다.
 *
 * 그래서 인앱 웹뷰에서는 자동 이동을 아예 시도하지 않고, 사용자 탭으로 스킴을
 * 열도록 버튼 href 자체를 itms-apps로 바꾼다. 앵커 탭은 사용자 제스처라
 * 웹뷰가 외부 앱 오픈으로 넘겨준다. 그것마저 막히면 x-safari-https로 Safari에
 * 넘기고, 마지막으로 수동 안내를 남긴다.
 *
 * 일반 브라우저에서는 https 링크가 정상 동작하므로 기존대로 자동 이동한다.
 * `?stay=1`을 붙이면 자동 이동 없이 페이지를 확인할 수 있다.
 */
export default function SmartLink() {
  const { platform, inApp } = useSyncExternalStore(
    subscribeToNothing,
    detectClient,
    getServerClient,
  );
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    if (new URLSearchParams(window.location.search).has("stay")) return;
    // 인앱 웹뷰가 막는 건 apps.apple.com과 스토어 스킴이다. 일반 https(구글폼,
    // Play 스토어)는 정상 이동하므로 iOS 인앱일 때만 자동 이동을 건너뛴다.
    if (inApp && platform === "ios") return;

    if (platform === "ios") {
      redirected.current = true;
      window.location.href = APP_STORE_URL;
      return;
    }

    if (platform === "android") {
      redirected.current = true;
      window.location.replace(ANDROID_TARGET);
    }
  }, [platform, inApp]);

  const showApple = platform === "ios" || platform === "unknown";
  const showAndroid = platform === "android" || platform === "unknown";

  // 인앱 웹뷰에서만 스킴을 쓴다. 일반 브라우저에서 itms-apps를 주면 데스크톱 등
  // 스킴 핸들러가 없는 환경에서 아무 일도 일어나지 않는다.
  const appleHref =
    inApp && platform === "ios" ? APP_STORE_SCHEME_URL : APP_STORE_URL;
  const showSafariFallback = inApp && platform === "ios";

  return (
    <>
      <Caption>
        {inApp
          ? "아래 버튼을 눌러 App Store로 이동하세요."
          : "스토어가 자동으로 열리지 않으면 아래 버튼을 눌러주세요."}
      </Caption>

      <CtaGroup>
        {showApple && (
          <StoreButton href={appleHref}>App Store에서 받기</StoreButton>
        )}

        {showSafariFallback && (
          <SecondaryButton href={APP_STORE_SAFARI_URL}>
            Safari로 열기
          </SecondaryButton>
        )}

        {showAndroid &&
          (PLAY_STORE_RELEASED ? (
            <StoreButton href={PLAY_STORE_URL}>
              Google Play에서 받기
            </StoreButton>
          ) : (
            <SecondaryButton href={ANDROID_BETA_FORM_URL}>
              Android 베타테스트 신청하기
            </SecondaryButton>
          ))}
      </CtaGroup>

      {showSafariFallback && (
        <Caption>
          그래도 열리지 않으면 우측 상단 ··· 메뉴에서 &lsquo;외부 브라우저로
          열기&rsquo;를 선택해 주세요.
        </Caption>
      )}
    </>
  );
}
