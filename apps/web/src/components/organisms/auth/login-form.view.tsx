"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { LOGIN_CARD_BORDER } from "@/styles/color";

// ── Styled ────────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100svh;
  padding: 24px;
  background: ${({ theme }) => theme.colors.gray50};
`;

const Card = styled.div`
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 24px;

  @media (min-width: 768px) {
    background: ${({ theme }) => theme.colors.white};
    border: 1px solid ${LOGIN_CARD_BORDER};
    border-radius: ${({ theme }) => theme.borderRadius.comfortable};
    padding: 32px;
  }
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
`;

const LogoImg = styled.img`
  height: 44px;
  width: auto;
  display: block;
  margin-bottom: 4px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.gray900};
  margin: 0;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.gray500};
  margin: 0;
  text-align: left;
`;

const ButtonList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const OAuthButton = styled.button<{
  $variant: "kakao" | "naver" | "google" | "apple";
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
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

const ErrorMessage = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dangerText};
  text-align: center;
  margin: 0;
`;

// ── Dev section ───────────────────────────────────────────────────────────────

const DevSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: ${({ theme }) => theme.colors.gray100};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px dashed ${({ theme }) => theme.colors.border};
`;

const DevLabel = styled.p`
  font-size: 11px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textGray};
  margin: 0;
  letter-spacing: 0.05em;
`;

const DevButtonRow = styled.div`
  display: flex;
  gap: 8px;
`;

const DevButton = styled.button`
  flex: 1;
  height: 36px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.white};
  color: ${({ theme }) => theme.colors.textDark};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.gray50};
  }
`;

// ── View ──────────────────────────────────────────────────────────────────────

interface LoginFormViewProps {
  hasError: boolean;
  onKakao: () => void;
  onNaver: () => void;
  onGoogle: () => Promise<void>;
  onApple: () => Promise<void>;
  onDevAdmin?: () => void;
  onDevUser?: () => void;
}

export default function LoginFormView({
  hasError,
  onKakao,
  onNaver,
  onGoogle,
  onApple,
  onDevAdmin,
  onDevUser,
}: LoginFormViewProps) {
  const t = useTranslations("login");

  return (
    <Wrapper>
      <Card>
        <Header>
          <LogoImg src="/gacha-map-logo.png" alt="가챠맵" />
          <Title>{t("title")}</Title>
          <Subtitle>{t("subtitle")}</Subtitle>
        </Header>

        {hasError && <ErrorMessage>{t("error")}</ErrorMessage>}

        <ButtonList>
          <OAuthButton $variant="kakao" onClick={onKakao}>
            <Image
              src="/kakao-logo.png"
              alt="kakao"
              width={20}
              height={20}
              style={{ objectFit: "contain" }}
            />
            {t("kakao")}
          </OAuthButton>
          <OAuthButton $variant="naver" onClick={onNaver}>
            <Image
              src="/naver-logo.png"
              alt="naver"
              width={20}
              height={20}
              style={{ objectFit: "contain" }}
            />
            {t("naver")}
          </OAuthButton>
          <OAuthButton $variant="google" onClick={onGoogle}>
            <Image
              src="/google-logo.png"
              alt="google"
              width={20}
              height={20}
              style={{ objectFit: "contain" }}
            />
            {t("google")}
          </OAuthButton>
          <OAuthButton $variant="apple" onClick={onApple}>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            {t("apple")}
          </OAuthButton>
        </ButtonList>

        {(onDevAdmin || onDevUser) && (
          <DevSection>
            <DevLabel>DEV ONLY</DevLabel>
            <DevButtonRow>
              {onDevAdmin && (
                <DevButton onClick={onDevAdmin}>Admin 로그인</DevButton>
              )}
              {onDevUser && (
                <DevButton onClick={onDevUser}>일반회원 로그인</DevButton>
              )}
            </DevButtonRow>
          </DevSection>
        )}
      </Card>
    </Wrapper>
  );
}
