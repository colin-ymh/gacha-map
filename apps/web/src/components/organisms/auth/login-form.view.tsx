"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import Image from "next/image";

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
    border: 1px solid #eeeeee;
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
              viewBox="0 0 814 1000"
              width="18"
              height="18"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-42.2-150.9-99.2-87.3-132.8-87.3-218.1c0-167.1 112.2-255.8 222.3-255.8 68.9 0 123.1 43 163.4 43 40.3 0 103.5-45.7 182.6-45.7 24.2 0 108.2 2.6 168.6 82.4zm-240.1-503.3c0-63.3 44.5-144.3 127.7-181.5 44.1-19.9 90.5-26.6 116.4-26.6 1.9 0 3.8 0 5.8.6-2.6 37.3-13.8 73.4-32.1 105.4-22.4 38.8-76.9 97.6-167.5 97.6-2.6 0-9-.6-50.3-4.5v9z" />
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
