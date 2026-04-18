import MapClient from "@/app/map-client";

interface Props {
  searchParams: Promise<{ shopId?: string }>;
}

export default async function ReportPage({ searchParams }: Props) {
  const { shopId } = await searchParams;
  return <MapClient initialPanelMode="report" initialShopId={shopId ?? null} />;
}
