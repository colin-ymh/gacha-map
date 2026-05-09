import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

interface NaverTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: string;
}

interface NaverUserResponse {
  resultcode: string;
  message: string;
  response: {
    id: string;
    email?: string;
    name?: string;
    nickname?: string;
  };
}

async function getNaverToken(
  code: string,
  state: string,
  redirectUri: string,
): Promise<NaverTokenResponse> {
  const res = await fetch("https://nid.naver.com/oauth2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.NAVER_CLIENT_ID!,
      client_secret: process.env.NAVER_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      code,
      state,
    }),
  });

  if (!res.ok) {
    throw new Error(`Naver token error: ${res.status}`);
  }

  return res.json() as Promise<NaverTokenResponse>;
}

async function getNaverUser(accessToken: string): Promise<NaverUserResponse> {
  const res = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Naver user info error: ${res.status}`);
  }

  return res.json() as Promise<NaverUserResponse>;
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
 * Naver OAuth 콜백.
 * 1. code → access_token 교환
 * 2. 네이버 사용자 정보 조회
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
    const redirectUri = `${origin}/api/auth/naver/callback`;
    const tokenData = await getNaverToken(code, state, redirectUri);
    const naverData = await getNaverUser(tokenData.access_token);

    const naverId = naverData.response.id;
    const email =
      naverData.response.email ??
      `naver_${naverId}@naver.oauth.gacha-map.internal`;
    const name = naverData.response.name ?? naverData.response.nickname ?? null;

    const adminClient = createAdminClient();

    const { error: upsertError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        provider: "naver",
        provider_id: naverId,
      },
    });

    if (
      upsertError &&
      !upsertError.message?.includes("already been registered")
    ) {
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
      console.error("[naver] generateLink error:", linkError);
      throw linkError;
    }

    if (linkData?.properties?.hashed_token) {
      const serverClient = await createClient();
      const { error: verifyError } = await serverClient.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: "email",
      });

      if (verifyError) {
        console.error("[naver] verifyOtp error:", verifyError);
        throw verifyError;
      }

      const response = NextResponse.redirect(redirectTo);
      response.cookies.delete("oauth_state");
      response.cookies.delete("oauth_return_url");
      return response;
    }

    if (linkData?.properties?.action_link) {
      const response = NextResponse.redirect(linkData.properties.action_link);
      response.cookies.delete("oauth_state");
      response.cookies.delete("oauth_return_url");
      return response;
    }

    throw new Error("magic link missing from generateLink response");
  } catch (err) {
    console.error("[naver callback error]", err);
    return NextResponse.redirect(`${origin}/login?error=naver_failed`);
  }
}
