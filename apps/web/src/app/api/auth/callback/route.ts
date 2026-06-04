import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

function isSafeReturnUrl(url: string, origin: string): boolean {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin;
  } catch {
    return false;
  }
}

/**
 * Supabase PKCE callback — Google OAuth 등 Supabase 내장 OAuth 완료 후 호출됨.
 * ?code= 파라미터를 세션으로 교환하고 홈으로 리다이렉트.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next =
    rawNext && isSafeReturnUrl(rawNext, origin)
      ? new URL(rawNext, origin).pathname + new URL(rawNext, origin).search
      : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // response를 먼저 생성하고 쿠키를 직접 response에 주입 —
  // next/headers cookieStore를 쓰면 redirect 응답에 쿠키가 포함되지 않음
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  return response;
}
