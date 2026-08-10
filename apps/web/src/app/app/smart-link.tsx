"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  APP_STORE_URL,
  APP_STORE_SCHEME_URL,
  PLAY_STORE_URL,
  PLAY_STORE_RELEASED,
  ANDROID_BETA_FORM_URL,
} from "@/constants/share";
import { CtaGroup, Caption, StoreButton, SecondaryButton } from "./styles";

type Platform = "ios" | "android" | "unknown";

// UA는 세션 중 바뀌지 않으므로 구독할 대상이 없다. 정리 함수만 반환한다.
const subscribeToNothing = () => () => {};

function getClientPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS 13+는 데스크톱 Safari UA를 쓰므로 터치 포인트로 보정한다.
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "unknown";
}

const getServerPlatform = (): Platform => "unknown";

const ANDROID_TARGET = PLAY_STORE_RELEASED
  ? PLAY_STORE_URL
  : ANDROID_BETA_FORM_URL;

/**
 * 인스타그램 프로필 바이오용 스마트 링크.
 *
 * 인스타 인앱 브라우저는 apps.apple.com https 링크를 네이티브 App Store로
 * 넘기지 못하고 빈 화면을 띄우는 일이 있다. 그래서 iOS는 OS가 직접 처리하는
 * itms-apps 스킴으로 자동 이동시키고, 그래도 안 열릴 때를 대비해 https 버튼을
 * 항상 함께 노출한다(사용자 탭은 웹뷰가 외부 이동으로 처리해 성공률이 높다).
 *
 * 자동 이동은 클라이언트에서만 일어나므로 unfurl 봇은 영향을 받지 않는다.
 * `?stay=1`을 붙이면 자동 이동 없이 페이지를 확인할 수 있다.
 */
export default function SmartLink() {
  const platform = useSyncExternalStore(
    subscribeToNothing,
    getClientPlatform,
    getServerPlatform,
  );
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    if (new URLSearchParams(window.location.search).has("stay")) return;

    if (platform === "ios") {
      redirected.current = true;
      window.location.href = APP_STORE_SCHEME_URL;
      return;
    }

    if (platform === "android") {
      redirected.current = true;
      window.location.replace(ANDROID_TARGET);
    }
  }, [platform]);

  const showApple = platform === "ios" || platform === "unknown";
  const showAndroid = platform === "android" || platform === "unknown";

  return (
    <>
      <Caption>스토어가 자동으로 열리지 않으면 아래 버튼을 눌러주세요.</Caption>

      <CtaGroup>
        {showApple && (
          <StoreButton href={APP_STORE_URL}>App Store에서 받기</StoreButton>
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
    </>
  );
}
