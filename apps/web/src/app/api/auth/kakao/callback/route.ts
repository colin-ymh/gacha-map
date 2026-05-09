import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface KakaoUserResponse {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
    };
  };
}

async function getKakaoToken(
  code: string,
  redirectUri: string,
): Promise<KakaoTokenResponse> {
  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.KAKAO_CLIENT_ID!,
      client_secret: process.env.KAKAO_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`Kakao token error: ${res.status}`);
  }

  return res.json() as Promise<KakaoTokenResponse>;
}

async function getKakaoUser(accessToken: string): Promise<KakaoUserResponse> {
  const res = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Kakao user info error: ${res.status}`);
  }

  return res.json() as Promise<KakaoUserResponse>;
}

function isSafeReturnUrl(url: string, origin: string): boolean {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin || parsed.protocol === "gacha-map:";
  } catch {
    return false;
  }
}

function isAppReturnUrl(url: string, origin: string): boolean {
  try {
    return new URL(url, origin).protocol === "gacha-map:";
  } catch {
    return false;
  }
}

/**
 * Kakao OAuth 콜백.
 * 1. state에서 returnUrl 추출 (쿠키 대신 state 파라미터 사용)
 * 2. code → access_token 교환
 * 3. 카카오 사용자 정보 조회
 * 4. Supabase 사용자 upsert (admin)
 * 5a. 앱 딥링크인 경우: verifyOtp로 세션 생성 → 토큰을 URL에 포함해 앱으로 리다이렉트
 * 5b. 웹인 경우: verifyOtp로 세션 쿠키 생성 → 웹으로 리다이렉트
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get("oauth_state")?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${origin}/login?error=invalid_state`);
  }

  // state에서 returnUrl 디코딩 (형식: nonce.base64url(returnUrl))
  const dotIndex = state.indexOf(".");
  let rawReturnUrl: string | null = null;
  if (dotIndex > 0) {
    try {
      rawReturnUrl = Buffer.from(
        state.slice(dotIndex + 1),
        "base64url",
      ).toString("utf-8");
    } catch {
      rawReturnUrl = null;
    }
  }

  const redirectTo =
    rawReturnUrl && isSafeReturnUrl(rawReturnUrl, origin)
      ? new URL(rawReturnUrl, origin).href
      : `${origin}/`;

  try {
    const redirectUri = `${origin}/api/auth/kakao/callback`;
    const tokenData = await getKakaoToken(code, redirectUri);
    const kakaoUser = await getKakaoUser(tokenData.access_token);

    const kakaoId = String(kakaoUser.id);
    const email =
      kakaoUser.kakao_account?.email ??
      `kakao_${kakaoId}@kakao.oauth.gacha-map.internal`;
    const name = kakaoUser.kakao_account?.profile?.nickname ?? null;

    const adminClient = createAdminClient();

    const { error: upsertError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        provider: "kakao",
        provider_id: kakaoId,
      },
    });

    if (
      upsertError &&
      !upsertError.message?.includes("already been registered")
    ) {
      throw upsertError;
    }

    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });

    if (linkError) {
      console.error("[kakao] generateLink error:", linkError);
      throw linkError;
    }

    if (!linkData?.properties?.hashed_token) {
      throw new Error("hashed_token missing from generateLink response");
    }

    const serverClient = await createClient();
    const { data: verifyData, error: verifyError } =
      await serverClient.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: "email",
      });

    if (verifyError) {
      console.error("[kakao] verifyOtp error:", verifyError);
      throw verifyError;
    }

    const response = (() => {
      // 앱 딥링크: 세션 토큰을 URL에 포함해 앱으로 전달 (Supabase Redirect URLs 불필요)
      if (isAppReturnUrl(redirectTo, origin) && verifyData?.session) {
        const appUrl = new URL(redirectTo);
        appUrl.searchParams.set(
          "access_token",
          verifyData.session.access_token,
        );
        appUrl.searchParams.set(
          "refresh_token",
          verifyData.session.refresh_token,
        );
        return NextResponse.redirect(appUrl.toString());
      }
      // 웹: 세션은 쿠키에 저장됨
      return NextResponse.redirect(redirectTo);
    })();

    response.cookies.delete("oauth_state");
    return response;
  } catch (err) {
    console.error("[kakao callback error]", err);
    return NextResponse.redirect(`${origin}/login?error=kakao_failed`);
  }
}
