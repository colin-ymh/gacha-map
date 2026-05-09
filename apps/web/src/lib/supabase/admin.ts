import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "./server";

type AdminAuthSuccess = { ok: true; user: User };
type AdminAuthFailure = { ok: false; response: NextResponse };
export type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure;

/**
 * Extract and verify admin access from request headers.
 * Returns user data if authenticated, otherwise returns error response.
 */
export async function verifyAdminAuth(
  request: NextRequest,
): Promise<AdminAuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 },
      ),
    };
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid or expired token" },
          { status: 401 },
        ),
      };
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profile?.role !== "admin") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Forbidden: Admin role required" },
          { status: 403 },
        ),
      };
    }

    return {
      ok: true,
      user: data.user,
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to verify token" },
        { status: 500 },
      ),
    };
  }
}
