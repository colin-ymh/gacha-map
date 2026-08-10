"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  PLAY_STORE_RELEASED,
  ANDROID_BETA_FORM_URL,
} from "@/constants/share";
import {
  CtaGroup,
  Caption,
  StoreButton,
  SecondaryButton,
  CopyButton,
  Notice,
  NoticeTitle,
  Step,
  UrlText,
} from "./styles";

type Platform = "ios" | "android" | "unknown";

interface Client {
  platform: Platform;
  /** 인스타/페북/스레드 인앱 웹뷰. App Store 이동이 차단된 환경. */
  metaWebView: boolean;
}

const SERVER_CLIENT: Client = { platform: "unknown", metaWebView: false };

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

  // 차단이 실기기에서 확인된 건 Meta 계열 웹뷰뿐이다. 카카오톡·라인 등 다른
  // 인앱 브라우저는 App Store 링크가 정상 동작하는 경우가 많아 포함하지 않는다.
  const metaWebView = /Instagram|FBAN|FBAV|FB_IAB|Threads/i.test(ua);

  cachedClient = { platform, metaWebView };
  return cachedClient;
}

const getServerClient = (): Client => SERVER_CLIENT;

const ANDROID_TARGET = PLAY_STORE_RELEASED
  ? PLAY_STORE_URL
  : ANDROID_BETA_FORM_URL;

/**
 * 인스타그램 프로필 바이오용 스마트 링크.
 *
 * 인스타 iOS 인앱 웹뷰에서는 App Store로 나가는 링크가 존재하지 않는다
 * (자세한 근거는 constants/share.ts 주석 참고). 그래서 그 환경에서는
 * 스토어 버튼 대신 외부 브라우저로 나가는 안내와 링크 복사를 제공한다.
 *
 * Android는 구글폼이 일반 https라 인앱에서도 정상 동작하므로 그대로 둔다.
 * `?stay=1`을 붙이면 자동 이동 없이 페이지를 확인할 수 있다.
 */
export default function SmartLink() {
  const { platform, metaWebView } = useSyncExternalStore(
    subscribeToNothing,
    detectClient,
    getServerClient,
  );
  const redirected = useRef(false);
  const [copied, setCopied] = useState(false);

  // 안내 화면을 띄우는 조건. iOS + Meta 웹뷰일 때만이다.
  const blocked = platform === "ios" && metaWebView;

  useEffect(() => {
    if (redirected.current) return;
    if (new URLSearchParams(window.location.search).has("stay")) return;
    if (blocked) return;

    if (platform === "ios") {
      redirected.current = true;
      window.location.href = APP_STORE_URL;
      return;
    }

    if (platform === "android") {
      redirected.current = true;
      window.location.replace(ANDROID_TARGET);
    }
  }, [platform, blocked]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(APP_STORE_URL);
      setCopied(true);
    } catch {
      // 클립보드 권한이 없는 웹뷰도 있다. 아래 주소를 길게 눌러 복사하면 된다.
      setCopied(false);
    }
  }

  if (blocked) {
    return (
      <>
        <Notice>
          <NoticeTitle>
            인스타그램 앱에서는 App Store로 바로 이동할 수 없어요
          </NoticeTitle>
          <Step>1. 화면 오른쪽 위 ··· 버튼을 누르세요</Step>
          <Step>2. &lsquo;외부 브라우저에서 열기&rsquo;를 선택하세요</Step>
          <Step>3. 열린 브라우저에서 설치 버튼을 누르면 됩니다</Step>
        </Notice>

        <CtaGroup>
          <CopyButton type="button" onClick={handleCopy}>
            {copied ? "복사됨! 브라우저에 붙여넣기" : "App Store 주소 복사"}
          </CopyButton>
        </CtaGroup>

        <Caption>복사가 안 되면 아래 주소를 길게 눌러 복사하세요.</Caption>
        <UrlText>{APP_STORE_URL}</UrlText>
      </>
    );
  }

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
