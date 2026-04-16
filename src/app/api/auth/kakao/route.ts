import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * Kakao OAuth 진입점.
 * 카카오 인증 페이지로 리다이렉트하고 CSRF 방지용 state 쿠키를 설정한다.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.KAKAO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Kakao OAuth is not configured" },
      { status: 503 },
    );
  }

  const { origin, searchParams } = new URL(request.url);
  const redirectUri = `${origin}/api/auth/kakao/callback`;
  const state = randomBytes(16).toString("hex");

  const kakaoAuthUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  kakaoAuthUrl.searchParams.set("client_id", clientId);
  kakaoAuthUrl.searchParams.set("redirect_uri", redirectUri);
  kakaoAuthUrl.searchParams.set("response_type", "code");
  kakaoAuthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(kakaoAuthUrl.toString());
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  };
  response.cookies.set("oauth_state", state, cookieOptions);

  const returnUrl = searchParams.get("returnUrl");
  if (returnUrl) {
    try {
      const parsed = new URL(returnUrl, origin);
      if (parsed.origin === origin) {
        response.cookies.set("oauth_return_url", returnUrl, cookieOptions);
      }
    } catch {
      // 잘못된 URL은 무시
    }
  }

  return response;
}
