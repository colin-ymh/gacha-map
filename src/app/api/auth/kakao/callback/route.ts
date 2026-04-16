import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

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

    // 사용자 upsert — 이미 있으면 메타데이터 업데이트
    const { data: userData, error: upsertError } =
      await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          provider: "kakao",
          provider_id: kakaoId,
        },
      });

    // 이미 존재하는 이메일이면 listUsers로 찾기
    let userId: string;
    if (upsertError?.message?.includes("already been registered")) {
      const { data: list } = await adminClient.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email === email);
      if (!existing) throw new Error("User not found after email conflict");
      userId = existing.id;
    } else if (upsertError) {
      throw upsertError;
    } else {
      userId = userData.user.id;
    }

    // returnUrl 쿠키 읽기 및 검증
    const rawReturnUrl = request.cookies.get("oauth_return_url")?.value;
    const redirectTo =
      rawReturnUrl && isSafeReturnUrl(rawReturnUrl, origin)
        ? `${origin}${rawReturnUrl.startsWith("/") ? rawReturnUrl : `/${rawReturnUrl}`}`
        : `${origin}/`;

    // 매직 링크 생성 → Supabase가 세션 토큰을 URL 해시로 전달
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });

    if (linkError || !linkData?.properties?.action_link) {
      throw linkError ?? new Error("Failed to generate magic link");
    }

    const response = NextResponse.redirect(linkData.properties.action_link);
    response.cookies.delete("oauth_state");
    response.cookies.delete("oauth_return_url");
    return response;
  } catch {
    return NextResponse.redirect(`${origin}/login?error=kakao_failed`);
  }
}
