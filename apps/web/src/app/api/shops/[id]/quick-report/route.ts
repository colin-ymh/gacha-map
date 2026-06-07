import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";
import { haversineDistanceMeters, getNewBadge } from "@gacha-map/shared";
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
      .select("role, contribution_count")
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

  const prevCount = profile?.contribution_count ?? 0;
  const newCount = prevCount + 1;

  await supabase
    .from("user_profiles")
    .update({ contribution_count: newCount })
    .eq("id", user.id);

  const newBadge = getNewBadge(prevCount, newCount);

  return NextResponse.json({
    success: true,
    contribution_count: newCount,
    new_badge: newBadge
      ? { id: newBadge.id, name: newBadge.name, emoji: newBadge.emoji }
      : null,
  });
}
