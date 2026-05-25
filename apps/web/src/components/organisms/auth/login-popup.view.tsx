"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/atoms/icons";

// ── Styled ────────────────────────────────────────────────────────────────────

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

const Card = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border-radius: ${({ theme }) => theme.borderRadius.comfortable};
  width: 100%;
  max-width: 360px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: ${({ theme }) => theme.shadow.card};
`;

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

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const OAuthButton = styled.button<{
  $variant: "kakao" | "naver" | "google" | "apple";
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
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
    if ($variant === "apple") {
      return `
        background: ${theme.colors.oauthAppleBg};
        color: ${theme.colors.oauthAppleText};
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

// ── View ──────────────────────────────────────────────────────────────────────

interface LoginPopupViewProps {
  onClose: () => void;
  onKakao: () => void;
  onNaver: () => void;
  onGoogle: () => void;
  onApple: () => void;
  title?: string;
  description?: string;
}

export default function LoginPopupView({
  onClose,
  onKakao,
  onNaver,
  onGoogle,
  onApple,
  title: titleProp,
  description: descProp,
}: LoginPopupViewProps) {
  const t = useTranslations("loginPopup");

  return (
    <Overlay onClick={onClose}>
      <Card
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <CardHeader>
          <TitleWrapper>
            <Title>{titleProp ?? t("title")}</Title>
            <Description>{descProp ?? t("description")}</Description>
          </TitleWrapper>
          <CloseButton onClick={onClose}>
            <CloseIcon size={18} />
          </CloseButton>
        </CardHeader>

        <ButtonContainer>
          <OAuthButton $variant="kakao" onClick={onKakao}>
            <OAuthLogo src="/kakao-logo.png" alt="kakao" />
            {t("kakao")}
          </OAuthButton>
          <OAuthButton $variant="naver" onClick={onNaver}>
            <OAuthLogo src="/naver-logo.png" alt="naver" />
            {t("naver")}
          </OAuthButton>
          <OAuthButton $variant="google" onClick={onGoogle}>
            <OAuthLogo src="/google-logo.png" alt="google" />
            {t("google")}
          </OAuthButton>
          <OAuthButton $variant="apple" onClick={onApple}>
            <svg
              viewBox="0 0 814 1000"
              width="18"
              height="18"
              fill="currentColor"
              aria-hidden="true"
              style={{ marginRight: 8, flexShrink: 0 }}
            >
              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.2-150.9-99.2-87.3-132.8-87.3-218.1c0-167.1 112.2-255.8 222.3-255.8 68.9 0 123.1 43 163.4 43 40.3 0 103.5-45.7 182.6-45.7 24.2 0 108.2 2.6 168.6 82.4zm-240.1-503.3c0-63.3 44.5-144.3 127.7-181.5 44.1-19.9 90.5-26.6 116.4-26.6 1.9 0 3.8 0 5.8.6-2.6 37.3-13.8 73.4-32.1 105.4-22.4 38.8-76.9 97.6-167.5 97.6-2.6 0-9-.6-50.3-4.5v9z" />
            </svg>
            {t("apple")}
          </OAuthButton>
        </ButtonContainer>

        <LaterButton onClick={onClose}>{t("later")}</LaterButton>
      </Card>
    </Overlay>
  );
}
