// WARNING: Node.js runtime 전용. Edge runtime으로 변경 금지 (SERVICE_ROLE_KEY 노출 위험)
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { getPublicSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/env";

function isAdminPath(pathname: string): boolean {
  if (pathname.startsWith("/admin")) return true;
  return routing.locales.some(
    (locale) =>
      pathname === `/${locale}/admin` ||
      pathname.startsWith(`/${locale}/admin/`),
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { url, anonKey } = getPublicSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /admin 경로는 어드민 권한 필요 (locale prefix 포함 대응)
  if (isAdminPath(request.nextUrl.pathname)) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }

    const serviceRoleKey = getSupabaseServiceRoleKey();
    const adminClient = createSupabaseClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
