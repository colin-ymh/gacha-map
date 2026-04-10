export interface Bounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export type ShopStatus = "pending" | "approved" | "rejected";
export type ReportStatus = "pending" | "reviewed" | "resolved";

export interface Shop {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  description: string | null;
  tags: string[];
  image_urls: string[];
  status: ShopStatus;
  is_authorized: boolean;
  place_id: string | null;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopSummary {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  tags: string[];
  image_urls: string[];
  is_authorized: boolean;
}

export type TemporalShopStatus = ShopStatus;

export interface TemporalShop {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  description: string | null;
  tags: string[];
  image_urls: string[];
  shop_id: string | null;
  submitter_name: string | null;
  submitter_contact: string | null;
  submitted_by: string | null;
  status: TemporalShopStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  shop_id: string | null;
  reporter_name: string | null;
  reporter_contact: string | null;
  content: string;
  status: ReportStatus;
  created_at: string;
}

export interface Wishlist {
  id: string;
  user_id: string;
  shop_id: string;
  created_at: string;
}
