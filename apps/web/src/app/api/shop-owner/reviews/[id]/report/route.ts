import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyShopOwnerAuth } from "@/lib/supabase/shop-owner";
import { containsProfanity } from "@gacha-map/shared";

const REASONS = ["spam", "abusive", "irrelevant", "fake", "other"] as const;
type ReviewReportReason = (typeof REASONS)[number];

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Props) {
  const authResult = await verifyShopOwnerAuth(request);
  if (!authResult.ok) return authResult.response;

  const { id: reviewId } = await params;

  let body: { reason?: string; reason_detail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const reason = body.reason as ReviewReportReason;
  if (!REASONS.includes(reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }

  const reasonDetail = body.reason_detail?.trim() || null;
  if (reason === "other") {
    if (
      !reasonDetail ||
      reasonDetail.length < 10 ||
      reasonDetail.length > 500
    ) {
      return NextResponse.json(
        {
          error:
            "reason_detail must be 10-500 characters when reason is 'other'",
        },
        { status: 400 },
      );
    }
    if (containsProfanity(reasonDetail)) {
      return NextResponse.json({ error: "profanity" }, { status: 400 });
    }
  }

  const supabase = createAdminClient();

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", authResult.user.id)
    .single();

  if (shopError) {
    if (shopError.code === "PGRST116") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    return NextResponse.json({ error: shopError.message }, { status: 500 });
  }

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id, content, image_urls")
    .eq("id", reviewId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("review_reports")
    .insert({
      review_id: review.id,
      shop_id: shop.id,
      review_content_snapshot: review.content,
      review_image_urls_snapshot: review.image_urls,
      reason,
      reason_detail: reasonDetail,
      submitted_by: authResult.user.id,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
