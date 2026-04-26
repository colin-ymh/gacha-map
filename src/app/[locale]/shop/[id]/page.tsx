import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ShopDetail } from "@/types";
import MapClient from "@/app/map-client";

export const revalidate = 300;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ShopPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data, error }, { count: wishlistCount }] = await Promise.all([
    supabase
      .from("shops")
      .select(
        "id, name, address, lat, lng, description, tags, image_urls, is_authorized, created_at, updated_at",
      )
      .eq("id", id)
      .eq("status", "active")
      .single(),
    supabase
      .from("wishlists")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", id),
  ]);

  if (error || !data) notFound();

  const initialShopData: ShopDetail = {
    ...data,
    wishlist_count: wishlistCount ?? 0,
  };

  return (
    <MapClient
      initialPanelMode="detail"
      initialShopId={id}
      initialShopData={initialShopData}
    />
  );
}
