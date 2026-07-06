export type UserRole = "user" | "shop_owner" | "admin";
export type SortOption = "name" | "distance" | "wishlist_count" | "recommended";

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
  phone?: string | null;
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
  proposed_shop_name: string | null;
  proposed_address: string | null;
  proposed_lat: number | null;
  proposed_lng: number | null;
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

export interface ProductWishlist {
  id: string;
  user_id: string;
  product_id: string;
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
  proposed_shop_name: string | null;
  proposed_address: string | null;
  proposed_lat: number | null;
  proposed_lng: number | null;
  created_at: string;
}

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DaySchedule {
  open?: string;
  close?: string;
  allDay?: boolean;
}

export interface BusinessHoursData {
  default: DaySchedule | null;
  overrides?: Partial<Record<DayKey, DaySchedule | null>>;
}

export interface GachaProductNameParts {
  tags: string[];
  series: { ja?: string; ko?: string; source?: string } | null;
  version: string | null;
  product_type: { ja?: string; ko?: string } | null;
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
  name_parts?: GachaProductNameParts | null;
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
  availability_status: ShopGachaProductAvailability;
}

export type QuickReportKind = "gacha_present" | "gacha_absent";

export interface ShopQuickReport {
  id: string;
  shop_id: string;
  user_id: string;
  kind: QuickReportKind;
  created_at: string;
}

/** @deprecated DB 기반 배지 시스템으로 대체됨. 기존 quick-report 연동 제거 후 삭제 예정 */
export type BadgeId =
  | "first_explorer"
  | "info_collector"
  | "gacha_hunter"
  | "gacha_doctor";

export interface Badge {
  id: BadgeId;
  name: string;
  emoji: string;
  threshold: number;
}

export const BADGES: Badge[] = [
  { id: "first_explorer", name: "첫 탐험가", emoji: "🗺️", threshold: 1 },
  { id: "info_collector", name: "정보 수집가", emoji: "📡", threshold: 5 },
  { id: "gacha_hunter", name: "가챠 헌터", emoji: "🔍", threshold: 15 },
  { id: "gacha_doctor", name: "가챠 박사", emoji: "🏆", threshold: 30 },
];

export function getNewBadge(prevCount: number, newCount: number): Badge | null {
  for (const badge of BADGES) {
    if (prevCount < badge.threshold && newCount >= badge.threshold) {
      return badge;
    }
  }
  return null;
}

export function getEarnedBadges(contributionCount: number): Badge[] {
  return BADGES.filter((b) => contributionCount >= b.threshold);
}

export * from "./badge";

export type GachaProductVariant = {
  id: string;
  product_id: string;
  name: string;
  name_ko: string | null;
  name_en: string | null;
  image_url: string | null;
  sort_order: number;
  status: "active" | "hidden" | "archived";
};

export type GachaRollPermission = {
  type: "free_daily";
  remainingToday: number;
  nextAvailableAt: string;
};

export type GachaRollResult = {
  variant: GachaProductVariant;
  rollId: string;
  permission: GachaRollPermission;
};
