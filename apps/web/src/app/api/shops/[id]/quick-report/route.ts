import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";
import { haversineDistanceMeters } from "@gacha-map/shared";
import {
  tryLogBadgeCount,
  checkAndAwardBadge,
  checkAnomalies,
} from "@/lib/badges";
import type { QuickReportKind } from "@gacha-map/shared";

export const dynamic = "force-dynamic";

const LOCATION_RADIUS_M = 500;

interface Props {
  params: Promise<{ id: string }>;
}

interface RequestBody {
  kind: QuickReportKind;
  user_lat: number;
  user_lng: number;
}

export async function POST(request: NextRequest, { params }: Props) {
  const { id: shopId } = await params;

  const { user } = await createAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { kind, user_lat, user_lng } = body;

  if (kind !== "gacha_present" && kind !== "gacha_absent") {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (typeof user_lat !== "number" || typeof user_lng !== "number") {
    return NextResponse.json(
      { error: "user_lat and user_lng required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const [{ data: shop }, { data: profile }] = await Promise.all([
    supabase
      .from("shops")
      .select("id, lat, lng")
      .eq("id", shopId)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    const distance = haversineDistanceMeters(
      user_lat,
      user_lng,
      shop.lat,
      shop.lng,
    );
    if (distance > LOCATION_RADIUS_M) {
      return NextResponse.json(
        { error: "Too far from shop", distance_m: Math.round(distance) },
        { status: 403 },
      );
    }
  }

  const { error: insertError } = await supabase
    .from("shop_quick_reports")
    .insert({ shop_id: shopId, user_id: user.id, kind });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Already reported" }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const counted = await tryLogBadgeCount(
    supabase,
    user.id,
    shopId,
    "quick_report",
  );
  let newBadge = null;
  if (counted) {
    newBadge = await checkAndAwardBadge(supabase, user.id, "quick_report");
    await checkAnomalies(supabase, user.id, "quick_report");
  }

  if (kind === "gacha_absent") {
    const { count } = await supabase
      .from("shop_quick_reports")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("kind", "gacha_absent")
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      );

    if ((count ?? 0) >= 3) {
      await supabase
        .from("shops")
        .update({ status: "hidden", hidden_reason: "auto_absent_report" })
        .eq("id", shopId)
        .eq("status", "active");
    }
  }

  return NextResponse.json({
    success: true,
    new_badge: newBadge
      ? { id: newBadge.id, name: newBadge.name, icon_url: newBadge.icon_url }
      : null,
  });
}
