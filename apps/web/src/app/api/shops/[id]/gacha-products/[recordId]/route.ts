import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; recordId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { id: shopId, recordId } = await params;
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const price_krw =
    typeof body.price_krw === "number" && body.price_krw >= 0
      ? Math.floor(body.price_krw)
      : null;

  const supabase = createAdminClient();

  const { data: record } = await supabase
    .from("shop_gacha_products")
    .select("id, availability_status")
    .eq("id", recordId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (record.availability_status !== "seen") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("shop_gacha_products")
    .update({ price_krw })
    .eq("id", recordId)
    .select("id, price_krw")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ price_krw: data.price_krw });
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const { id: shopId, recordId } = await params;
  const { user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("shop_gacha_products")
    .delete()
    .eq("id", recordId)
    .eq("shop_id", shopId)
    .eq("reported_by", user.id)
    .eq("source", "user_report")
    .is("verified_by", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
