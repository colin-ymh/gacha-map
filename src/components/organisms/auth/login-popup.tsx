"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import { createClient } from "@/lib/supabase/client";

interface LoginPopupProps {
  onClose: () => void;
  returnUrl?: string;
  title?: string;
  description?: string;
}

// ── Overlay ────────────────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 999;
`;

// ── Card ───────────────────────────────────────────────────────────────────────

const Card = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border-radius: 16px;
  width: 100%;
  max-width: 360px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

// ── Header ─────────────────────────────────────────────────────────────────────

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
`;

const TitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.h2`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.gray900};
  margin: 0;
`;

const Description = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.gray500};
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.gray500};
  font-size: 16px;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    color: ${({ theme }) => theme.colors.gray700};
  }
`;

// ── Buttons ────────────────────────────────────────────────────────────────────

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const OAuthButton = styled.button<{ $variant: "kakao" | "naver" | "google" }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  border-radius: 8px;
  border: none;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.88;
  }

  &:active {
    opacity: 0.75;
  }

  ${({ $variant, theme }) => {
    if ($variant === "kakao") {
      return `
        background: ${theme.colors.oauthKakaoBg};
        color: ${theme.colors.oauthKakaoText};
      `;
    }
    if ($variant === "naver") {
      return `
        background: ${theme.colors.oauthNaverBg};
        color: ${theme.colors.oauthNaverText};
      `;
    }
    return `
      background: ${theme.colors.oauthGoogleBg};
      color: ${theme.colors.oauthGoogleText};
      border: 1px solid ${theme.colors.oauthGoogleBorder};
    `;
  }}
`;

const OAuthLogo = styled.img`
  width: 20px;
  height: 20px;
  object-fit: contain;
  margin-right: 8px;
  flex-shrink: 0;
`;

const LaterButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.gray400};
  padding: 8px;
  text-align: center;
  transition: color 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.gray600};
  }
`;

// ── Utilities ──────────────────────────────────────────────────────────────────

function isSafeReturnUrl(url: string, origin: string): boolean {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin;
  } catch {
    return false;
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function LoginPopup({
  onClose,
  returnUrl,
  title: titleProp,
  description: descProp,
}: LoginPopupProps) {
  const t = useTranslations("loginPopup");

  const safeReturnUrl =
    returnUrl &&
    typeof window !== "undefined" &&
    isSafeReturnUrl(returnUrl, window.location.origin)
      ? returnUrl
      : "/";

  function handleKakao() {
    if (typeof window !== "undefined") {
      const encodedUrl = encodeURIComponent(safeReturnUrl);
      window.location.href = `/api/auth/kakao?returnUrl=${encodedUrl}`;
    }
  }

  function handleNaver() {
    if (typeof window !== "undefined") {
      const encodedUrl = encodeURIComponent(safeReturnUrl);
      window.location.href = `/api/auth/naver?returnUrl=${encodedUrl}`;
    }
  }

  async function handleGoogle() {
    const supabase = createClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/auth/callback?returnUrl=${encodeURIComponent(safeReturnUrl)}`
        : "/api/auth/callback";

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  // ESC 키로 닫기
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <Overlay onClick={onClose}>
      <Card onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <TitleWrapper>
            <Title>{titleProp ?? t("title")}</Title>
            <Description>{descProp ?? t("description")}</Description>
          </TitleWrapper>
          <CloseButton onClick={onClose}>✕</CloseButton>
        </CardHeader>

        <ButtonContainer>
          <OAuthButton $variant="kakao" onClick={handleKakao}>
            <OAuthLogo src="/kakao-logo.png" alt="kakao" />
            {t("kakao")}
          </OAuthButton>
          <OAuthButton $variant="naver" onClick={handleNaver}>
            <OAuthLogo src="/naver-logo.png" alt="naver" />
            {t("naver")}
          </OAuthButton>
          <OAuthButton $variant="google" onClick={handleGoogle}>
            <OAuthLogo src="/google-logo.png" alt="google" />
            {t("google")}
          </OAuthButton>
        </ButtonContainer>

        <LaterButton onClick={onClose}>{t("later")}</LaterButton>
      </Card>
    </Overlay>
  );
}
