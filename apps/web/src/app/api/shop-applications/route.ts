import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";
import type { ShopOwnerApplicationType, ShopOwnerApplication } from "@/types";
import { containsProfanity } from "@gacha-map/shared";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shop_owner_applications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    applications: (data ?? []) as ShopOwnerApplication[],
    total: data?.length ?? 0,
  });
}

export async function POST(request: NextRequest) {
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const {
    type,
    shop_id,
    business_registration_number,
    representative_name,
    phone_number,
    shop_name,
    address,
    lat,
    lng,
    message,
  } = body as Record<string, unknown>;

  const VALID_TYPES: ShopOwnerApplicationType[] = ["new_shop", "claim_shop"];
  if (!VALID_TYPES.includes(type as ShopOwnerApplicationType)) {
    return NextResponse.json(
      { error: "type must be one of: new_shop, claim_shop" },
      { status: 400 },
    );
  }

  if (
    typeof business_registration_number !== "string" ||
    !business_registration_number.trim()
  ) {
    return NextResponse.json(
      { error: "business_registration_number is required" },
      { status: 400 },
    );
  }

  if (typeof representative_name !== "string" || !representative_name.trim()) {
    return NextResponse.json(
      { error: "representative_name is required" },
      { status: 400 },
    );
  }

  if (typeof phone_number !== "string" || !phone_number.trim()) {
    return NextResponse.json(
      { error: "phone_number is required" },
      { status: 400 },
    );
  }

  if (type === "claim_shop") {
    if (typeof shop_id !== "string" || !UUID_PATTERN.test(shop_id)) {
      return NextResponse.json(
        {
          error: "shop_id is required and must be a valid UUID for claim_shop",
        },
        { status: 400 },
      );
    }
  }

  if (type === "new_shop") {
    if (typeof shop_name !== "string" || !shop_name.trim()) {
      return NextResponse.json(
        { error: "shop_name is required for new_shop" },
        { status: 400 },
      );
    }
    if (typeof address !== "string" || !address.trim()) {
      return NextResponse.json(
        { error: "address is required for new_shop" },
        { status: 400 },
      );
    }
  }

  if (lat !== undefined && lat !== null && typeof lat !== "number") {
    return NextResponse.json(
      { error: "lat must be a number" },
      { status: 400 },
    );
  }
  if (lng !== undefined && lng !== null && typeof lng !== "number") {
    return NextResponse.json(
      { error: "lng must be a number" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // claim_shop: 샵 존재 및 활성 상태 검증
  if (type === "claim_shop" && typeof shop_id === "string") {
    const { data: targetShop } = await supabase
      .from("shops")
      .select("id, status")
      .eq("id", shop_id)
      .maybeSingle();

    if (!targetShop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    if (targetShop.status !== "active") {
      return NextResponse.json(
        { error: "Cannot claim a non-active shop" },
        { status: 400 },
      );
    }
  }

  // 중복 pending 신청 검사 (claim_shop)
  if (type === "claim_shop" && typeof shop_id === "string") {
    const { data: existing } = await supabase
      .from("shop_owner_applications")
      .select("id")
      .eq("user_id", user.id)
      .eq("shop_id", shop_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A pending application already exists for this shop" },
        { status: 409 },
      );
    }
  }

  const trimmedMessage =
    typeof message === "string" ? message.trim() || null : null;
  if (trimmedMessage && containsProfanity(trimmedMessage)) {
    return NextResponse.json({ error: "profanity" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("shop_owner_applications")
    .insert({
      type: type as ShopOwnerApplicationType,
      user_id: user.id,
      shop_id: type === "claim_shop" ? (shop_id as string) : null,
      business_registration_number: (
        business_registration_number as string
      ).trim(),
      representative_name: (representative_name as string).trim(),
      phone_number: (phone_number as string).trim(),
      shop_name: typeof shop_name === "string" ? shop_name.trim() : null,
      address: typeof address === "string" ? address.trim() : null,
      lat: typeof lat === "number" ? lat : null,
      lng: typeof lng === "number" ? lng : null,
      message: trimmedMessage,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
