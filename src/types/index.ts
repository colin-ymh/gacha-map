export type UserRole = "user" | "shop_owner" | "admin";
export type SortOption = "name" | "distance" | "wishlist_count";

export interface UserProfile {
  id: string;
  role: UserRole;
  email: string | null;
  name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export type ShopStatus = "active" | "hidden" | "archived";
export type TemporalShopStatus = "pending" | "approved" | "rejected";
export type ReportStatus = "pending" | "reviewed" | "resolved";
export type ReportType = "new_shop" | "fix_info" | "closed" | "other";

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
  candidate_group_id: number | null;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
  wishlist_count?: number;
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
  wishlist_count?: number;
}

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
  report_type: ReportType;
  user_id: string | null;
  reporter_name: string | null;
  reporter_contact: string | null;
  content: string;
  status: ReportStatus;
  created_at: string;
}

export interface MyReport {
  id: string;
  shop_id: string | null;
  shop_name: string | null;
  report_type: ReportType;
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

export interface ShopDetail {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  description: string | null;
  tags: string[];
  image_urls: string[];
  is_authorized: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminShopItem {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  tags: string[];
  is_authorized: boolean;
  status: ShopStatus;
  created_at: string;
}

export interface AdminReportItem {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  tags: string[];
  submitter_name: string | null;
  submitter_contact: string | null;
  shop_id: string | null;
  status: TemporalShopStatus;
  admin_note: string | null;
  created_at: string;
}
