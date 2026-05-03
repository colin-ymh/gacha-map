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
    return parsed.origin === origin;
  } catch {
    return false;
  }
}

/**
 * Kakao OAuth 콜백.
 * 1. code → access_token 교환
 * 2. 카카오 사용자 정보 조회
 * 3. Supabase 사용자 upsert (admin)
 * 4. 매직 링크로 세션 생성 → 앱으로 리다이렉트
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = request.cookies.get("oauth_state")?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${origin}/login?error=invalid_state`);
  }

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

    // 사용자 upsert — 이미 있으면 422 반환 (정상)
    const { error: upsertError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        provider: "kakao",
        provider_id: kakaoId,
      },
    });

    if (upsertError && upsertError.status !== 422) {
      throw upsertError;
    }

    // returnUrl 쿠키 읽기 및 검증
    const rawReturnUrl = request.cookies.get("oauth_return_url")?.value;
    const redirectTo =
      rawReturnUrl && isSafeReturnUrl(rawReturnUrl, origin)
        ? new URL(rawReturnUrl, origin).href
        : `${origin}/`;

    // 매직 링크 생성 → hashed_token 추출 → 서버에서 직접 세션 교환
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
    console.log(
      "[kakao] linkData.properties:",
      JSON.stringify(linkData?.properties),
    );

    if (!linkData?.properties?.hashed_token) {
      throw new Error("hashed_token missing from generateLink response");
    }

    const serverClient = await createClient();
    const { error: verifyError } = await serverClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "email",
    });

    if (verifyError) {
      console.error("[kakao] verifyOtp error:", verifyError);
      throw verifyError;
    }

    const response = NextResponse.redirect(redirectTo);
    response.cookies.delete("oauth_state");
    response.cookies.delete("oauth_return_url");
    return response;
  } catch (err) {
    console.error("[kakao callback error]", err);
    return NextResponse.redirect(`${origin}/login?error=kakao_failed`);
  }
}
