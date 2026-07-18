import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ productId: string }>;
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const { productId } = await params;
  const { supabase, user } = await createAuthenticatedClient(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("product_wishlists")
    .delete()
    .eq("user_id", user.id)
    .eq("product_id", productId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wished: false });
}
