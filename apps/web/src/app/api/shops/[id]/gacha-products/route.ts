import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const GACHA_PRODUCT_SELECT =
  "id, manufacturer, name, name_ja, name_ko, name_en, price_jpy, release_month, official_image_url, status";

const SGP_PUBLIC_SELECT = `id, shop_id, gacha_product_id, price_krw, availability_status, source, verified_at, created_at, updated_at, gacha_product:gacha_products(${GACHA_PRODUCT_SELECT})`;

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
  const { id: shopId } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("shop_gacha_products")
    .select(SGP_PUBLIC_SELECT)
    .eq("shop_id", shopId)
    .order("source", { ascending: false }) // shop_owner < user_report alphabetically — use raw SQL workaround below
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sort: shop_owner rows first
  const sorted = (data ?? []).sort((a, b) => {
    if (a.source === "shop_owner" && b.source !== "shop_owner") return -1;
    if (a.source !== "shop_owner" && b.source === "shop_owner") return 1;
    return 0;
  });

  let userQuickReport: string | null = null;
  try {
    const { user } = await createAuthenticatedClient(request);
    if (user) {
      const { data: qr } = await supabase
        .from("shop_quick_reports")
        .select("kind")
        .eq("shop_id", shopId)
        .eq("user_id", user.id)
        .maybeSingle();
      userQuickReport = qr?.kind ?? null;
    }
  } catch {
    // auth failure — keep null
  }

  return NextResponse.json({ products: sorted, user_quick_report: userQuickReport });
}

interface PostBody {
  gacha_product_id: string;
  price_krw?: number;
}

export async function POST(request: NextRequest, { params }: Props) {
  const { id: shopId } = await params;
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { gacha_product_id, price_krw } = body;

  if (!gacha_product_id || typeof gacha_product_id !== "string") {
    return NextResponse.json(
      { error: "gacha_product_id is required" },
      { status: 400 },
    );
  }

  if (
    price_krw !== undefined &&
    (typeof price_krw !== "number" || price_krw < 0)
  ) {
    return NextResponse.json(
      { error: "price_krw must be a non-negative number" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Verify shop exists
  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .maybeSingle();

  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  // Verify gacha_product exists and is active
  const { data: product } = await supabase
    .from("gacha_products")
    .select("id")
    .eq("id", gacha_product_id)
    .eq("status", "active")
    .maybeSingle();

  if (!product) {
    return NextResponse.json(
      { error: "Gacha product not found or inactive" },
      { status: 404 },
    );
  }

  // Explicit upsert: SELECT → UPDATE or INSERT
  const { data: existing } = await supabase
    .from("shop_gacha_products")
    .select("id")
    .eq("shop_id", shopId)
    .eq("gacha_product_id", gacha_product_id)
    .eq("reported_by", user.id)
    .eq("source", "user_report")
    .maybeSingle();

  let record;

  if (existing) {
    const { data, error } = await supabase
      .from("shop_gacha_products")
      .update({
        price_krw: price_krw ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select(SGP_PUBLIC_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    record = data;
  } else {
    const { data, error } = await supabase
      .from("shop_gacha_products")
      .insert({
        shop_id: shopId,
        gacha_product_id,
        price_krw: price_krw ?? null,
        source: "user_report",
        reported_by: user.id,
        availability_status: "seen",
      })
      .select(SGP_PUBLIC_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    record = data;
  }

  return NextResponse.json(
    { product: record },
    { status: existing ? 200 : 201 },
  );
}
