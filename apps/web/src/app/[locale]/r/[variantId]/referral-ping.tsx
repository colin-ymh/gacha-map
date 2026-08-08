"use client";

import { useEffect, useRef } from "react";

interface Props {
  code: string;
  variantId: string | null;
}

/**
 * 공유 링크 유입을 초대자에게 적립한다.
 *
 * 서버 컴포넌트가 아니라 클라이언트에서 쏘는 이유:
 * 1. 서버 컴포넌트는 쿠키를 설정할 수 없다. 방문자 식별 쿠키는 Route Handler만 심을 수 있다.
 * 2. 렌더 도중 DB에 쓰면 프리페치·캐시와 얽혀 중복되거나 누락된다.
 *
 * 부수 효과로 카카오톡·슬랙 같은 링크 미리보기 크롤러는 JS를 실행하지 않아
 * 자동으로 집계에서 빠진다. 반대로 JS가 막힌 환경에서는 적립되지 않는다 — 감수한다.
 */
export default function ReferralPing({ code, variantId }: Props) {
  const sent = useRef(false);

  useEffect(() => {
    // StrictMode의 이중 마운트 방어.
    if (sent.current) return;
    sent.current = true;

    // 새로고침 연타로 같은 요청이 반복되는 것도 막는다.
    // (중복 적립 자체는 DB 유니크 인덱스가 이미 막지만, 요청까지 아낀다.)
    const key = `gm_ref_sent:${code}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // 프라이빗 모드 등에서 sessionStorage가 막혀도 적립은 계속 시도한다.
    }

    void fetch("/api/referral/click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code, variantId }),
      keepalive: true,
    }).catch(() => {
      // 적립 실패가 랜딩 화면에 영향을 주면 안 된다.
    });
  }, [code, variantId]);

  return null;
}
