import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data, error }, { count: wishlistCount }] = await Promise.all([
    supabase
      .from("shops")
      .select(
        "id, name, address, lat, lng, description, tags, image_urls, is_authorized, created_at, updated_at",
      )
      .eq("id", id)
      .eq("status", "active")
      .single(),
    supabase
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

  return NextResponse.json({
    shop: { ...data, wishlist_count: wishlistCount ?? 0 },
  });
}
