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

export interface TileRange {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  zoom: number;
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
  image_urls: string[];
  image_thumbnails?: string[];
  status: ShopStatus;
  is_authorized: boolean;
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
  image_urls: string[];
  image_thumbnails?: string[];
  is_authorized: boolean;
  wishlist_count?: number;
  opening_hours?: string | null;
}

export interface TemporalShop {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  description: string | null;
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
  phone: string | null;
  opening_hours: string | null;
  image_urls: string[];
  image_thumbnails?: string[];
  is_authorized: boolean;
  owner_id?: string | null;
  created_at: string;
  updated_at: string;
  wishlist_count?: number;
}

export interface AdminShopItem {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  image_urls: string[];
  image_thumbnails: string[];
  is_authorized: boolean;
  status: ShopStatus;
  created_at: string;
}

export interface ShopImageReport {
  id: string;
  shop_id: string;
  image_url: string;
  thumb_url: string | null;
  status: "pending" | "approved" | "rejected";
  source: "admin" | "user_report";
  submitted_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AdminReportItem {
  id: string;
  shop_id: string | null;
  shop_name: string | null;
  report_type: ReportType;
  reporter_name: string | null;
  reporter_contact: string | null;
  content: string;
  status: ReportStatus;
  created_at: string;
}

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DaySchedule {
  open: string;
  close: string;
}

export interface BusinessHoursData {
  default: DaySchedule | null;
  overrides?: Partial<Record<DayKey, DaySchedule | null>>;
}

export interface GachaProduct {
  id: string;
  manufacturer: string;
  name: string;
  name_ja: string | null;
  name_ko: string | null;
  name_en: string | null;
  price_jpy: number | null;
  release_month: string | null;
  official_image_url: string | null;
  status: "active" | "inactive";
}

export type ShopGachaProductSource = "user_report" | "shop_owner" | "admin";
export type ShopGachaProductAvailability =
  | "available"
  | "sold_out"
  | "seen"
  | "unknown";

export interface ShopGachaProduct {
  id: string;
  shop_id: string;
  gacha_product_id: string;
  price_krw: number | null;
  availability_status: ShopGachaProductAvailability;
  source: ShopGachaProductSource;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  gacha_product: GachaProduct;
}

export interface ShopGachaProductInternal extends ShopGachaProduct {
  reported_by: string | null;
  verified_by: string | null;
}

export interface GachaProductWithShops extends GachaProduct {
  available_shop_count: number;
  min_price_krw: number | null;
}

export interface GachaShopEntry {
  shop_id: string;
  shop_name: string;
  address: string | null;
  image_url: string | null;
  price_krw: number | null;
}
