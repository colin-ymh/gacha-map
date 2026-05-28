import { NextRequest, NextResponse } from "next/server";
import {
  createAdminClient,
  createAuthenticatedClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; recordId: string }>;
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
