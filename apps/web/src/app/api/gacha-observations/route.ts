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

  // 비인증 샵에 shop_id가 있으면 즉시 gacha_products + shop_gacha_products 생성
  if (shop_id) {
    const { data: shop } = await supabase
      .from("shops")
      .select("is_authorized")
      .eq("id", shop_id)
      .single();

    if (shop && !shop.is_authorized) {
      const { data: product, error: productError } = await supabase
        .from("gacha_products")
        .insert({
          name: name.trim(),
          name_ko: name.trim(),
          normalized_name: name.trim().toLowerCase(),
          manufacturer: "직접입력",
          source_type: "user_manual",
          source_url: null,
          status: "active",
        })
        .select("id")
        .single();

      if (productError || !product) {
        return NextResponse.json({ error: productError?.message ?? "insert failed" }, { status: 500 });
      }

      const { error: sgpError } = await supabase
        .from("shop_gacha_products")
        .insert({
          shop_id,
          gacha_product_id: product.id,
          source: "user_report",
          reported_by: user.id,
          availability_status: "seen",
        });

      if (sgpError) {
        return NextResponse.json({ error: sgpError.message }, { status: 500 });
      }

      return NextResponse.json({ product_id: product.id, type: "direct" }, { status: 201 });
    }
  }

  // 인증 샵이거나 shop_id 없음: 기존 observation 흐름
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

  return NextResponse.json({ observation_id: data.id, type: "observation" }, { status: 201 });
}
