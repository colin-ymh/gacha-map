import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * Naver OAuth 진입점.
 * 네이버 인증 페이지로 리다이렉트하고 CSRF 방지용 state 쿠키를 설정한다.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.NAVER_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Naver OAuth is not configured" },
      { status: 503 },
    );
  }

  const { origin, searchParams } = new URL(request.url);
  const redirectUri = `${origin}/api/auth/naver/callback`;
  const state = randomBytes(16).toString("hex");

  const naverAuthUrl = new URL("https://nid.naver.com/oauth2.0/authorize");
  naverAuthUrl.searchParams.set("response_type", "code");
  naverAuthUrl.searchParams.set("client_id", clientId);
  naverAuthUrl.searchParams.set("redirect_uri", redirectUri);
  naverAuthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(naverAuthUrl.toString());
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
