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

  // scan에서 넘어온 observation_id가 있으면 해당 observation에 discovery_request만 추가
  if (observation_id && typeof observation_id === "string") {
    await supabase.from("gacha_product_discovery_requests").insert({
      observation_id,
      shop_id: shop_id ?? null,
      extracted_title_ko: name.trim(),
      status: "pending",
    });
    return NextResponse.json({ observation_id, type: "observation" }, { status: 201 });
  }

  // 직접 입력 (scan 없음): observation 생성 → discovery_request
  // gacha_products 즉시 생성 금지 — collector가 공식 상품 수집 후 처리
  const { data: obs, error: obsError } = await supabase
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

  if (obsError || !obs) {
    return NextResponse.json({ error: obsError?.message ?? "insert failed" }, { status: 500 });
  }

  await supabase.from("gacha_product_discovery_requests").insert({
    observation_id: obs.id,
    shop_id: shop_id ?? null,
    extracted_title_ko: name.trim(),
    manufacturer_hint: manufacturer?.trim() ?? null,
    price_krw: price_krw ?? null,
    status: "pending",
  });

  return NextResponse.json({ observation_id: obs.id, type: "observation" }, { status: 201 });
}
