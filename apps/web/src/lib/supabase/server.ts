import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv, getSupabaseServiceRoleKey } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseEnv();

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );
}

export function createAdminClient() {
  const { url } = getPublicSupabaseEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
