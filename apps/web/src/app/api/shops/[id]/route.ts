import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const [{ data, error }, { count: wishlistCount }] = await Promise.all([
    supabase
      .from("shops")
      .select(
        "id, name, address, lat, lng, description, phone, opening_hours, tags, image_urls, image_thumbnails, is_authorized, owner_id, created_at, updated_at",
      )
      .eq("id", id)
      .eq("status", "active")
      .single(),
    adminClient
      .from("wishlists")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", id),
  ]);

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let representativeImageUrl: string | null = data.image_urls?.[0] ?? null;
  if (!representativeImageUrl) {
    const { data: firstReview } = await adminClient
      .from("reviews")
      .select("image_urls")
      .eq("shop_id", id)
      .neq("image_urls", "{}")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    representativeImageUrl = firstReview?.image_urls?.[0] ?? null;
  }

  return NextResponse.json({
    shop: {
      ...data,
      wishlist_count: wishlistCount ?? 0,
      representative_image_url: representativeImageUrl,
    },
  });
}
