import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, createAdminClient } from "@/lib/supabase/server";
import type { GachaProductVariant, GachaRollResult } from "@gacha-map/shared";

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Props) {
  const { id: productId } = await params;

  const { user } = await createAuthenticatedClient(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();

  // Fetch active variants
  const { data: variants, error: variantsError } = await adminClient
    .from("gacha_product_variants")
    .select("id, product_id, name, name_ko, name_en, image_url, sort_order, status")
    .eq("product_id", productId)
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (variantsError) {
    return NextResponse.json({ error: variantsError.message }, { status: 500 });
  }

  if (!variants || variants.length === 0) {
    return NextResponse.json({ error: "no_variants" }, { status: 422 });
  }

  const tomorrowKST = (() => {
    const d = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
    );
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  // Server-side random selection
  const variant = variants[Math.floor(Math.random() * variants.length)] as GachaProductVariant;

  const doInsert = async () =>
    adminClient
      .from("gacha_roll_results")
      .insert({ user_id: user.id, product_id: productId, variant_id: variant.id, roll_type: "free_daily" })
      .select("id")
      .single();

  let { data: roll, error: insertError } = await doInsert();

  if (insertError) {
    if (insertError.code === "23505") {
      // DEV: limit disabled — delete today's record and re-roll
      await adminClient
        .from("gacha_roll_results")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .eq("roll_type", "free_daily");
      ({ data: roll, error: insertError } = await doInsert());
    }
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const result: GachaRollResult = {
    variant,
    rollId: roll!.id,
    permission: {
      type: "free_daily",
      remainingToday: 0,
      nextAvailableAt: tomorrowKST.toISOString(),
    },
  };

  return NextResponse.json(result);
}
