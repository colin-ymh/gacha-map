import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'

function isAdminPath(pathname: string): boolean {
  if (pathname.startsWith('/admin')) return true
  return routing.locales.some(
    locale =>
      pathname === `/${locale}/admin` ||
      pathname.startsWith(`/${locale}/admin/`)
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // /admin 경로는 어드민 권한 필요 (locale prefix 포함 대응)
  if (isAdminPath(request.nextUrl.pathname)) {
    const isAdmin = user?.app_metadata?.role === 'admin'
    if (!isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
