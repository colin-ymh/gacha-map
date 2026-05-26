import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Props) {
  const { id: shopId } = await params;
  const adminClient = createAdminClient();

  const { data: reviews, error } = await adminClient
    .from("reviews")
    .select("image_urls")
    .eq("shop_id", shopId)
    .neq("image_urls", "{}")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const images = (reviews ?? []).flatMap((r) => r.image_urls as string[]);

  return NextResponse.json({ images, total: images.length });
}
