import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import { getUserGachaCollections } from "@/lib/gacha/rollStats";

export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ collections: [] });
  }

  const collections = await getUserGachaCollections(supabase, user.id);
  return NextResponse.json({ collections });
}
