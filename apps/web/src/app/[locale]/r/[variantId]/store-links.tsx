"use client";

import { useSyncExternalStore } from "react";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  PLAY_STORE_RELEASED,
} from "@/constants/share";
import {
  CtaGroup,
  CtaCaption,
  StoreButton,
  StoreButtonDisabled,
} from "./styles";

type Platform = "ios" | "android" | "unknown";

// UA는 세션 중 바뀌지 않으므로 구독할 대상이 없다. 정리 함수만 반환한다.
const subscribeToNothing = () => () => {};

function getClientPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "unknown";
}

const getServerPlatform = (): Platform => "unknown";

interface Props {
  appStoreLabel: string;
  playStoreLabel: string;
  playComingSoonLabel: string;
  ctaCaption: string;
}

/**
 * 스토어 버튼.
 *
 * 플랫폼 판별을 서버에서 하지 않는 이유: unfurl 봇과 사람이 같은 URL을 받으므로
 * User-Agent로 서버 분기를 하면 봇이 캐싱한 프리뷰와 사람이 보는 화면이 어긋난다.
 * 자동 리다이렉트도 하지 않는다 — 봇이 따라가면 OG 파싱이 깨지고, 사람 쪽에서도
 * 스팸으로 취급될 수 있다.
 */
export default function StoreLinks({
  appStoreLabel,
  playStoreLabel,
  playComingSoonLabel,
  ctaCaption,
}: Props) {
  // UA는 변하지 않는 외부 값이라 effect + setState 대신 useSyncExternalStore로 읽는다.
  // 서버 스냅샷이 "unknown"이라 첫 렌더가 서버와 일치해 hydration 불일치도 없다.
  const platform = useSyncExternalStore(
    subscribeToNothing,
    getClientPlatform,
    getServerPlatform,
  );

  const showApple = platform === "ios" || platform === "unknown";
  const showPlay = platform === "android" || platform === "unknown";

  return (
    <CtaGroup>
      {ctaCaption && <CtaCaption>{ctaCaption}</CtaCaption>}

      {showApple && (
        <StoreButton href={APP_STORE_URL}>{appStoreLabel}</StoreButton>
      )}

      {showPlay &&
        (PLAY_STORE_RELEASED ? (
          <StoreButton href={PLAY_STORE_URL}>{playStoreLabel}</StoreButton>
        ) : (
          <StoreButtonDisabled>{playComingSoonLabel}</StoreButtonDisabled>
        ))}
    </CtaGroup>
  );
}
