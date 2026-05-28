import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GachaProduct } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

function withDisplayName(product: Omit<GachaProduct, "display_name">) {
  return {
    ...product,
    display_name: product.name_ko ?? product.name_ja ?? product.name,
  };
}

export async function GET(_request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gacha_products")
    .select(
      [
        "id",
        "manufacturer",
        "name",
        "name_ja",
        "name_ko",
        "name_en",
        "jan_code",
        "product_code",
        "price_jpy",
        "release_month",
        "release_week_text",
        "types_count",
        "official_image_url",
        "source_url",
        "source_type",
        "status",
        "created_at",
        "updated_at",
        "last_seen_at",
      ].join(", "),
    )
    .eq("id", id)
    .eq("status", "active")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Gacha product not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    product: withDisplayName(data as unknown as Omit<GachaProduct, "display_name">),
  });
}
