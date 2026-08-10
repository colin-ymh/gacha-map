"use client";

import { useSyncExternalStore } from "react";
import { DebugBox, DebugLine, DebugLink, DebugTitle } from "./styles";

/**
 * `/app?debug=1` 전용 진단 패널.
 *
 * 인앱 웹뷰가 어떤 형태의 App Store 링크를 통과시키는지는 문서화돼 있지 않고
 * 앱 버전마다 다르다. 후보를 한 화면에 늘어놓고 실제 기기에서 하나씩 눌러
 * 되는 것을 찾기 위한 임시 도구다. 원인이 확정되면 제거한다.
 */
const CANDIDATES: { label: string; href: string; blank?: boolean }[] = [
  {
    label: "1. https (locale 없음)",
    href: "https://apps.apple.com/app/id6772389763",
  },
  {
    label: "2. https + /kr",
    href: "https://apps.apple.com/kr/app/id6772389763",
  },
  {
    label: "3. https + target=_blank",
    href: "https://apps.apple.com/app/id6772389763",
    blank: true,
  },
  {
    label: "4. itms-apps (s 하나)",
    href: "itms-apps://apps.apple.com/app/id6772389763",
  },
  {
    label: "5. itms-appss (s 두개)",
    href: "itms-appss://apps.apple.com/app/id6772389763",
  },
  {
    label: "6. itunes.apple.com",
    href: "https://itunes.apple.com/kr/app/id6772389763?mt=8",
  },
  {
    label: "7. x-safari-https",
    href: "x-safari-https://apps.apple.com/app/id6772389763",
  },
  { label: "8. 앱 홈 (웹 대조군)", href: "https://www.apple.com/kr/" },
];

// UA는 세션 중 바뀌지 않으므로 구독할 대상이 없다. 정리 함수만 반환한다.
const subscribeToNothing = () => () => {};
const getClientUa = () => navigator.userAgent;
const getServerUa = () => "";

export default function DebugLinks() {
  const ua = useSyncExternalStore(subscribeToNothing, getClientUa, getServerUa);

  const inApp =
    /Instagram|FBAN|FBAV|FB_IAB|KAKAOTALK|Line\/|NAVER|DaumApps|Threads/i.test(
      ua,
    );
  const isIos = /iPhone|iPad|iPod/i.test(ua);

  return (
    <DebugBox>
      <DebugTitle>진단 모드</DebugTitle>
      <DebugLine>inApp: {String(inApp)}</DebugLine>
      <DebugLine>iOS: {String(isIos)}</DebugLine>
      <DebugLine>UA: {ua || "(읽는 중)"}</DebugLine>

      <DebugTitle>아래를 하나씩 눌러 어떤 게 열리는지 확인</DebugTitle>
      {CANDIDATES.map((c) => (
        <DebugLink
          key={c.label}
          href={c.href}
          {...(c.blank ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {c.label}
        </DebugLink>
      ))}
    </DebugBox>
  );
}
