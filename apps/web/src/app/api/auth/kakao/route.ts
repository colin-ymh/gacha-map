import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

function isSafeReturnUrl(url: string, origin: string): boolean {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin || parsed.protocol === "gacha-map:";
  } catch {
    return false;
  }
}

/**
 * Kakao OAuth 진입점.
 * 카카오 인증 페이지로 리다이렉트하고 CSRF 방지용 state 쿠키를 설정한다.
 * returnUrl은 state 파라미터에 인코딩하여 전달한다 (쿠키 의존 제거).
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
  const nonce = randomBytes(16).toString("hex");

  const returnUrl = searchParams.get("returnUrl");
  const safeReturnUrl =
    returnUrl && isSafeReturnUrl(returnUrl, origin) ? returnUrl : null;

  // state = nonce.base64url(returnUrl) — returnUrl을 state에 인코딩해 쿠키 없이 전달
  const stateValue = safeReturnUrl
    ? `${nonce}.${Buffer.from(safeReturnUrl).toString("base64url")}`
    : nonce;

  const kakaoAuthUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  kakaoAuthUrl.searchParams.set("client_id", clientId);
  kakaoAuthUrl.searchParams.set("redirect_uri", redirectUri);
  kakaoAuthUrl.searchParams.set("response_type", "code");
  kakaoAuthUrl.searchParams.set("state", stateValue);

  const response = NextResponse.redirect(kakaoAuthUrl.toString());
  response.cookies.set("oauth_state", stateValue, {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
