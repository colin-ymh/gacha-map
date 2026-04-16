"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import styled from "styled-components";
import { createClient } from "@/lib/supabase/client";

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
    border-radius: 12px;
    padding: 32px;
  }
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
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

const OAuthButton = styled.button<{ $variant: "kakao" | "naver" | "google" }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
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

const ErrorMessage = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dangerText};
  text-align: center;
  margin: 0;
`;

export default function LoginForm() {
  const t = useTranslations("login");
  const searchParams = useSearchParams();
  const hasError = searchParams.has("error");

  function handleKakao() {
    window.location.href = "/api/auth/kakao";
  }

  function handleNaver() {
    window.location.href = "/api/auth/naver";
  }

  async function handleGoogle() {
    const supabase = createClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/auth/callback`
        : "/api/auth/callback";

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  return (
    <Wrapper>
      <Card>
        <Header>
          <Title>{t("title")}</Title>
          <Subtitle>{t("subtitle")}</Subtitle>
        </Header>

        {hasError && <ErrorMessage>{t("error")}</ErrorMessage>}

        <ButtonList>
          <OAuthButton $variant="kakao" onClick={handleKakao}>
            {t("kakao")}
          </OAuthButton>
          <OAuthButton $variant="naver" onClick={handleNaver}>
            {t("naver")}
          </OAuthButton>
          <OAuthButton $variant="google" onClick={handleGoogle}>
            {t("google")}
          </OAuthButton>
        </ButtonList>
      </Card>
    </Wrapper>
  );
}
