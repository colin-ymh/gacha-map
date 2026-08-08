import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import { getProductRollStats } from "@/lib/gacha/rollStats";
import type { GachaRollStats } from "@gacha-map/shared";

const EMPTY_STATS: GachaRollStats = {
  totalCount: 0,
  todayCount: 0,
  variantStats: [],
};

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
  const { id: productId } = await params;

  const { supabase, user } = await createAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json(EMPTY_STATS);
  }

  const stats = await getProductRollStats(supabase, user.id, productId);
  return NextResponse.json(stats);
}
