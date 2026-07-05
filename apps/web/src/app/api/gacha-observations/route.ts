import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PostBody {
  name: string;
  manufacturer?: string;
  price_krw?: number;
  shop_id?: string;
}

export async function POST(request: NextRequest) {
  const { user } = await createAuthenticatedClient(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, manufacturer, price_krw, shop_id } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (price_krw !== undefined && (typeof price_krw !== "number" || price_krw < 0)) {
    return NextResponse.json({ error: "price_krw must be a non-negative number" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("gacha_product_observations")
    .insert({
      shop_id: shop_id ?? null,
      observed_title_ko: name.trim(),
      manufacturer_hint: manufacturer?.trim() ?? null,
      price_krw: price_krw ?? null,
      source_type: "user_manual",
      status: "needs_review",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ observation_id: data.id }, { status: 201 });
}
