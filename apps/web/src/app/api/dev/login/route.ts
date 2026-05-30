import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }

  const role = request.nextUrl.searchParams.get("role") ?? "user";
  const origin = request.nextUrl.origin;
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("id")
    .eq("role", role === "admin" ? "admin" : "user")
    .limit(1)
    .single();

  if (!profile) {
    return NextResponse.json(
      { error: `No ${role} user found` },
      { status: 404 },
    );
  }

  const {
    data: { user },
  } = await admin.auth.admin.getUserById(profile.id);
  if (!user?.email) {
    return NextResponse.json({ error: "User has no email" }, { status: 500 });
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });

  if (error || !data.properties?.hashed_token) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to generate link" },
      { status: 500 },
    );
  }

  const next = role === "admin" ? "/admin/shops" : "/";
  const response = NextResponse.redirect(`${origin}${next}`);

  // callback/route.ts 패턴: response에 직접 쿠키 주입
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

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  return response;
}
