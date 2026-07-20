import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "@/lib/supabase/admin";
import type { AdminReviewReportItem, ReviewReportStatus } from "@/types";

const DEFAULT_LIMIT = 50;
const STATUSES: ReviewReportStatus[] = ["pending", "approved", "rejected"];

export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { searchParams } = request.nextUrl;
  const status = (searchParams.get("status") ??
    "pending") as ReviewReportStatus;
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );

  if (!STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Invalid status parameter" },
      { status: 400 },
    );
  }

  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, 100);

  const supabase = createAdminClient();

  const { data, error, count } = await supabase
    .from("review_reports")
    .select(
      `id, review_id, shop_id, review_content_snapshot, review_image_urls_snapshot,
       reason, reason_detail, status, created_at, reviewed_at,
       shops(name),
       submitted_by_profile:user_profiles!review_reports_submitted_by_fkey(nickname),
       reviews(content, image_urls, user_profiles!reviews_user_id_fkey(nickname))`,
      { count: "exact" },
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reports: AdminReviewReportItem[] = (data ?? []).map((row) => {
    const shop = row.shops as { name: string } | { name: string }[] | null;
    const shopName = Array.isArray(shop)
      ? (shop[0]?.name ?? null)
      : (shop?.name ?? null);

    const submittedProfile = row.submitted_by_profile as
      { nickname: string | null } | { nickname: string | null }[] | null;
    const reporterNickname = Array.isArray(submittedProfile)
      ? (submittedProfile[0]?.nickname ?? null)
      : (submittedProfile?.nickname ?? null);

    const review = row.reviews as
      | {
          content: string | null;
          image_urls: string[];
          user_profiles:
            { nickname: string | null } | { nickname: string | null }[] | null;
        }
      | {
          content: string | null;
          image_urls: string[];
          user_profiles:
            { nickname: string | null } | { nickname: string | null }[] | null;
        }[]
      | null;
    const reviewRow = Array.isArray(review) ? (review[0] ?? null) : review;
    const reviewAuthorProfile = reviewRow?.user_profiles ?? null;
    const reviewAuthorNickname = Array.isArray(reviewAuthorProfile)
      ? (reviewAuthorProfile[0]?.nickname ?? null)
      : (reviewAuthorProfile?.nickname ?? null);

    return {
      id: row.id,
      review_id: row.review_id,
      shop_id: row.shop_id,
      shop_name: shopName,
      reason: row.reason,
      reason_detail: row.reason_detail,
      status: row.status,
      created_at: row.created_at,
      reviewed_at: row.reviewed_at,
      reporter_nickname: reporterNickname,
      review_content: reviewRow?.content ?? row.review_content_snapshot,
      review_image_urls:
        reviewRow?.image_urls ?? row.review_image_urls_snapshot,
      review_author_nickname: reviewAuthorNickname,
      review_deleted: row.review_id === null,
    };
  });

  return NextResponse.json({
    reports,
    total: count ?? 0,
    offset,
    limit,
  });
}
