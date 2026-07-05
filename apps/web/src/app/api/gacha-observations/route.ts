import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PostBody {
  name: string;
  manufacturer?: string;
  price_krw?: number;
  shop_id?: string;
  observation_id?: string;
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

  const { name, manufacturer, price_krw, shop_id, observation_id } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (price_krw !== undefined && (typeof price_krw !== "number" || price_krw < 0)) {
    return NextResponse.json({ error: "price_krw must be a non-negative number" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // user_manual 상품 생성: status "hidden"으로 전역 검색에 노출되지 않음
  // shop_gacha_products에는 연결되어 샵 상세 제보 목록에는 노출됨
  const { data: product, error: productError } = await supabase
    .from("gacha_products")
    .insert({
      name: name.trim(),
      name_ko: name.trim(),
      normalized_name: name.trim().toLowerCase(),
      manufacturer: manufacturer?.trim() ?? "직접입력",
      source_type: "user_manual",
      source_url: null,
      status: "hidden",
    })
    .select("id")
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: productError?.message ?? "insert failed" }, { status: 500 });
  }

  if (shop_id) {
    await supabase.from("shop_gacha_products").insert({
      shop_id,
      gacha_product_id: product.id,
      source: "user_report",
      reported_by: user.id,
      availability_status: "seen",
    });
  }

  // discovery_request: collector가 공식 상품 찾아서 user_manual 교체
  const obsId = observation_id && typeof observation_id === "string" ? observation_id : null;
  if (!obsId) {
    // scan 없는 직접 입력 — observation 먼저 생성
    const { data: obs } = await supabase
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

    if (obs) {
      await supabase.from("gacha_product_discovery_requests").insert({
        observation_id: obs.id,
        shop_id: shop_id ?? null,
        user_manual_product_id: product.id,
        extracted_title_ko: name.trim(),
        manufacturer_hint: manufacturer?.trim() ?? null,
        price_krw: price_krw ?? null,
        status: "pending",
      });
    }
  } else {
    await supabase.from("gacha_product_discovery_requests").insert({
      observation_id: obsId,
      shop_id: shop_id ?? null,
      user_manual_product_id: product.id,
      extracted_title_ko: name.trim(),
      status: "pending",
    });
  }

  return NextResponse.json({ product_id: product.id, type: "direct" }, { status: 201 });
}
