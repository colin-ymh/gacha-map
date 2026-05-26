import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import type { AdminGachaProductItem, GachaProductStatus } from "@/types";

const PRODUCT_STATUSES: GachaProductStatus[] = [
  "active",
  "hidden",
  "archived",
];

interface Props {
  params: Promise<{ id: string }>;
}

interface RequestBody {
  name?: string;
  name_ja?: string | null;
  name_ko?: string | null;
  name_en?: string | null;
  status?: GachaProductStatus;
  official_image_url?: string | null;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updatePayload: Partial<RequestBody> & { normalized_name?: string } = {};

  if ("name" in body) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: "Invalid name value" },
        { status: 400 },
      );
    }
    updatePayload.name = body.name.trim();
    updatePayload.normalized_name = normalizeName(body.name);
  }

  for (const field of ["name_ja", "name_ko", "name_en"] as const) {
    if (field in body) {
      if (!isNullableString(body[field])) {
        return NextResponse.json(
          { error: `Invalid ${field} value` },
          { status: 400 },
        );
      }
      updatePayload[field] = body[field]?.trim() || null;
    }
  }

  if ("official_image_url" in body) {
    if (!isNullableString(body.official_image_url)) {
      return NextResponse.json(
        { error: "Invalid official_image_url value" },
        { status: 400 },
      );
    }
    updatePayload.official_image_url = body.official_image_url?.trim() || null;
  }

  if ("status" in body) {
    if (!PRODUCT_STATUSES.includes(body.status as GachaProductStatus)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 },
      );
    }
    updatePayload.status = body.status;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { error: "At least one editable field must be provided" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("gacha_products")
    .update(updatePayload)
    .eq("id", id)
    .select(
      [
        "id",
        "manufacturer",
        "name",
        "normalized_name",
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
    product: data as unknown as AdminGachaProductItem,
  });
}
