import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import { getProductCollectionDetail } from "@/lib/gacha/rollStats";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
  const { id: productId } = await params;
  const { supabase, user } = await createAuthenticatedClient(request);

  const detail = await getProductCollectionDetail(
    supabase,
    user?.id ?? null,
    productId,
  );
  return NextResponse.json(detail);
}
