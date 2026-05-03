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

const OAuthButton = styled.button<{ $variant: "kakao" | "naver" | "google" }>`
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
  title?: string;
  description?: string;
}

export default function LoginPopupView({
  onClose,
  onKakao,
  onNaver,
  onGoogle,
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
        </ButtonContainer>

        <LaterButton onClick={onClose}>{t("later")}</LaterButton>
      </Card>
    </Overlay>
  );
}
