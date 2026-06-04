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
 * Naver OAuth 콜백.
 * 1. state에서 returnUrl 추출 (쿠키 대신 state 파라미터 사용)
 * 2. code → access_token 교환
 * 3. 네이버 사용자 정보 조회
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
      console.error("[naver] verifyOtp error:", verifyError);
      throw verifyError;
    }

    const response = (() => {
      // 앱 딥링크: 세션 토큰을 hash fragment에 포함해 앱으로 전달
      // query param 대신 hash를 사용하여 서버 로그/Referer 헤더에 토큰 노출 방지
      if (isAppReturnUrl(redirectTo, origin) && verifyData?.session) {
        const appUrl = new URL(redirectTo);
        const hashParams = new URLSearchParams({
          access_token: verifyData.session.access_token,
          refresh_token: verifyData.session.refresh_token,
        });
        appUrl.hash = hashParams.toString();
        return NextResponse.redirect(appUrl.toString());
      }
      // 웹: 세션은 쿠키에 저장됨
      return NextResponse.redirect(redirectTo);
    })();

    response.cookies.delete("oauth_state");
    return response;
  } catch (err) {
    console.error("[naver callback error]", err);
    return NextResponse.redirect(`${origin}/login?error=naver_failed`);
  }
}
