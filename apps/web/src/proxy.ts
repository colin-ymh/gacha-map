import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const supabaseResponse = await updateSession(request);

  // 세션 미들웨어가 redirect를 반환한 경우 (예: /admin 인증 보호) 그대로 반환
  if (supabaseResponse.status !== 200) {
    return supabaseResponse;
  }

  const intlResponse = intlMiddleware(request);

  // Supabase 세션 갱신 쿠키를 intl 응답에 복사 (누락 시 AT/RT가 브라우저에 전달되지 않음)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  return intlResponse;
}

// `app`은 인스타 바이오용 스마트 링크 경로다. locale prefix로 리다이렉트되면
// 인앱 브라우저에서 홉이 하나 더 늘어 실패 확률이 올라가므로 intl 라우팅에서 제외한다.
export const config = {
  matcher: ["/((?!_next|_vercel|api|app$|.*\\..*).*)"],
};
