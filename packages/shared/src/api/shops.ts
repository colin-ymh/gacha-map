import type { ShopSummary, ShopDetail, Bounds, SortOption } from "../types";

export interface FetchShopsParams {
  bounds?: Bounds;
  q?: string;
  tag?: string;
  sort?: SortOption;
  offset?: number;
  limit?: number;
  userLat?: number;
  userLng?: number;
}

export interface FetchShopsResult {
  shops: ShopSummary[];
  total: number;
  offset: number;
  limit: number;
}

export async function fetchShops(
  baseUrl: string,
  params: FetchShopsParams = {},
): Promise<FetchShopsResult> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.tag) query.set("tag", params.tag);
  if (params.sort) query.set("sort", params.sort);
  if (params.offset != null) query.set("offset", String(params.offset));
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.userLat != null) query.set("lat", String(params.userLat));
  if (params.userLng != null) query.set("lng", String(params.userLng));
  if (params.bounds) {
    query.set("swLat", String(params.bounds.swLat));
    query.set("swLng", String(params.bounds.swLng));
    query.set("neLat", String(params.bounds.neLat));
    query.set("neLng", String(params.bounds.neLng));
  }

  const res = await fetch(`${baseUrl}/api/shops?${query.toString()}`);
  if (!res.ok) throw new Error(`fetchShops failed: ${res.status}`);
  return res.json() as Promise<FetchShopsResult>;
}

export async function fetchShopDetail(
  baseUrl: string,
  id: string,
): Promise<ShopDetail> {
  const res = await fetch(`${baseUrl}/api/shops/${id}`);
  if (!res.ok) throw new Error(`fetchShopDetail failed: ${res.status}`);
  const { shop } = await res.json();
  return shop as ShopDetail;
}
