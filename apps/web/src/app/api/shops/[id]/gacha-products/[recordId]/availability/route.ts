import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; recordId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { id: shopId, recordId } = await params;
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("shop_gacha_products")
    .select("id, availability_status")
    .eq("id", recordId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isCurrentlySoldOut = existing.availability_status === "sold_out";

  const update = isCurrentlySoldOut
    ? {
        availability_status: "seen" as const,
        unavailable_by: null,
        unavailable_at: null,
      }
    : {
        availability_status: "sold_out" as const,
        unavailable_by: user.id,
        unavailable_at: new Date().toISOString(),
      };

  const { data: updated, error: updateError } = await supabase
    .from("shop_gacha_products")
    .update(update)
    .eq("id", recordId)
    .select("id, availability_status, unavailable_by, unavailable_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  let unavailable_by_nickname: string | null = null;
  if (updated.unavailable_by) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("nickname")
      .eq("id", updated.unavailable_by)
      .maybeSingle();
    unavailable_by_nickname =
      (profile as { nickname?: string } | null)?.nickname ?? null;
  }

  return NextResponse.json({ ...updated, unavailable_by_nickname });
}
