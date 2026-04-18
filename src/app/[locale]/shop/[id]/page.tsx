import MapClient from "@/app/map-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ShopPage({ params }: Props) {
  const { id } = await params;
  return <MapClient initialPanelMode="detail" initialShopId={id} />;
}
