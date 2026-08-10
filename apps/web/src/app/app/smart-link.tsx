"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  PLAY_STORE_RELEASED,
  ANDROID_BETA_FORM_URL,
} from "@/constants/share";
import {
  ArrowHint,
  StoreButton,
  TextButton,
  PlatformCard,
  PlatformLabel,
  NoticeTitle,
  NoticeStrong,
} from "./styles";

type Platform = "ios" | "android" | "unknown";
type Store = "ios" | "android";

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
 * 감지된 플랫폼 카드 하나만 보여주고, 반대 플랫폼은 아래 전환 링크로 연다.
 *
 * 인스타 iOS 인앱 웹뷰에서는 App Store로 나가는 링크가 존재하지 않는다
 * (자세한 근거는 constants/share.ts 주석 참고). 그 환경에서는 스토어 버튼
 * 대신 외부 브라우저로 나가는 안내를 띄운다. 외부 브라우저로 나가면 아래
 * 자동 이동이 그대로 동작해 App Store가 바로 열린다.
 *
 * Android는 구글폼이 일반 https라 인앱에서도 정상 동작한다.
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
  const [picked, setPicked] = useState<Store | null>(null);

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
      // 클립보드가 막힌 웹뷰도 있다. 그때는 외부 브라우저 안내만 남는다.
      setCopied(false);
    }
  }

  // 감지된 플랫폼 카드만 보여준다. 사용자가 직접 고르면 그 선택이 우선한다.
  // 감지에 실패한 데스크톱 등은 iOS를 기본으로 두되 전환 링크로 넘어갈 수 있다.
  const shown: Store = picked ?? (platform === "android" ? "android" : "ios");
  const other: Store = shown === "ios" ? "android" : "ios";
  const showArrow = blocked && shown === "ios";

  return (
    <>
      {showArrow && (
        <ArrowHint aria-hidden="true">
          <svg width="72" height="86" viewBox="0 0 72 86" fill="none">
            {/* 우상단 ··· 버튼으로 휘어 올라가는 화살표 */}
            <path
              d="M14 82 C10 50 24 22 58 14"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M42 10 L60 12 L54 29"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </ArrowHint>
      )}

      {shown === "ios" ? (
        <PlatformCard>
          <PlatformLabel>iPhone · iPad</PlatformLabel>

          {blocked ? (
            <>
              <NoticeTitle>오른쪽 위 ··· 를 누르고</NoticeTitle>
              <NoticeStrong>&lsquo;외부 브라우저에서 열기&rsquo;</NoticeStrong>
              <TextButton type="button" onClick={handleCopy}>
                {copied ? "주소 복사됨" : "App Store 주소 복사"}
              </TextButton>
            </>
          ) : (
            <StoreButton href={APP_STORE_URL}>App Store에서 받기</StoreButton>
          )}
        </PlatformCard>
      ) : (
        <PlatformCard>
          <PlatformLabel>Android</PlatformLabel>

          {PLAY_STORE_RELEASED ? (
            <StoreButton href={PLAY_STORE_URL}>
              Google Play에서 받기
            </StoreButton>
          ) : (
            <>
              <NoticeTitle>정식 출시 준비 중이에요</NoticeTitle>
              <StoreButton href={ANDROID_BETA_FORM_URL}>
                베타테스트 신청하기
              </StoreButton>
            </>
          )}
        </PlatformCard>
      )}

      <TextButton type="button" onClick={() => setPicked(other)}>
        {other === "android" ? "Android 사용자인가요?" : "iPhone 사용자인가요?"}
      </TextButton>
    </>
  );
}
