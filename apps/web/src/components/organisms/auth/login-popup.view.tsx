"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/atoms/icons";
import { MODAL_OVERLAY } from "@/styles/color";

// ── Styled ────────────────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${MODAL_OVERLAY};
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
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="currentColor"
              aria-hidden="true"
              style={{ marginRight: 8, flexShrink: 0 }}
            >
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            {t("apple")}
          </OAuthButton>
        </ButtonContainer>

        <LaterButton onClick={onClose}>{t("later")}</LaterButton>
      </Card>
    </Overlay>
  );
}
