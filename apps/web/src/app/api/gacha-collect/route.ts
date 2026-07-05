import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { collectForObservation } from "./_collect";

export const dynamic = "force-dynamic";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export async function POST(request: NextRequest) {
  // admin or internal service only
  const authHeader = request.headers.get("authorization");
  const internalHeader = request.headers.get("x-internal-secret");

  const isInternal = INTERNAL_SECRET && internalHeader === INTERNAL_SECRET;

  if (!isInternal) {
    const supabase = createAdminClient();
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { ip_name?: string; series_label?: string; manufacturer_hint?: string; observation_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.ip_name || typeof body.ip_name !== "string") {
    return NextResponse.json({ error: "ip_name is required" }, { status: 400 });
  }

  await collectForObservation({
    observation_id: body.observation_id ?? null,
    ip_name: body.ip_name,
    series_label: body.series_label ?? null,
    manufacturer_hint: body.manufacturer_hint ?? null,
  });

  return NextResponse.json({ ok: true });
}
