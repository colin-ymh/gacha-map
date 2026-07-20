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
  phone: string | null;
  opening_hours: string | null;
  status: ShopStatus;
  is_authorized: boolean;
  owner_id?: string | null;
  candidate_group_id: number | null;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
  wishlist_count?: number;
}

export interface Review {
  id: string;
  shop_id: string;
  user_id: string;
  content: string | null;
  image_urls: string[];
  created_at: string;
  updated_at: string;
  user: {
    nickname: string | null;
    avatar_url: string | null;
    main_badge: { id: string; name: string; icon_url: string } | null;
  } | null;
}

export interface ShopSummary {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
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
  is_authorized: boolean;
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
  is_authorized: boolean;
  status: ShopStatus;
  created_at: string;
  owner_id: string | null;
  quick_report_present?: number;
  quick_report_absent?: number;
  hidden_reason?: "manual" | "auto_absent_report" | null;
  opening_hours?: string | null;
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
  user_id: string | null;
  user_nickname: string | null;
  user_email: string | null;
  user_created_at: string | null;
}

export type ReviewReportStatus = "pending" | "approved" | "rejected";
export type ReviewReportReason =
  "spam" | "abusive" | "irrelevant" | "fake" | "other";

export interface AdminReviewReportItem {
  id: string;
  review_id: string | null;
  shop_id: string;
  shop_name: string | null;
  reason: ReviewReportReason;
  reason_detail: string | null;
  status: ReviewReportStatus;
  created_at: string;
  reviewed_at: string | null;
  reporter_nickname: string | null;
  review_content: string | null;
  review_image_urls: string[];
  review_author_nickname: string | null;
  review_deleted: boolean;
}

export type ShopOwnerApplicationType = "new_shop" | "claim_shop";
export type ShopOwnerApplicationStatus = "pending" | "approved" | "rejected";

export interface ShopOwnerApplication {
  id: string;
  type: ShopOwnerApplicationType;
  user_id: string;
  shop_id: string | null;
  business_registration_number: string;
  representative_name: string;
  phone_number: string;
  shop_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  message: string | null;
  status: ShopOwnerApplicationStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminShopOwnerApplicationItem extends ShopOwnerApplication {
  shop_name_existing: string | null;
}

export interface ShopOwnerShop {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  description: string | null;
  phone: string | null;
  opening_hours: string | null;
  is_authorized: boolean;
  status: ShopStatus;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export type GachaProductStatus = "active" | "hidden" | "archived";

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
  display_name: string;
  normalized_name?: string;
  name_ja: string | null;
  name_ko: string | null;
  name_en: string | null;
  jan_code: string | null;
  product_code: string | null;
  price_jpy: number | null;
  release_month: string | null;
  release_week_text: string | null;
  types_count: number | null;
  official_image_url: string | null;
  source_url: string;
  source_type: "official";
  status: GachaProductStatus;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
  name_parts?: GachaProductNameParts | null;
}

export interface AdminGachaProductItem extends GachaProduct {
  normalized_name: string;
  pending_candidate?: AdminGachaProductPendingCandidate | null;
}

export type GachaProductNameCandidateSourceType =
  "official_ko" | "domestic_vendor" | "admin" | "machine" | "user_alias";

export type GachaProductNameCandidateStatus =
  "pending" | "approved" | "rejected";

export interface AdminGachaProductPendingCandidate {
  id: string;
  name: string;
  status: GachaProductNameCandidateStatus;
  source_type: GachaProductNameCandidateSourceType;
  source_name: string;
}

export interface GachaProductNameCandidate {
  id: string;
  product_id: string;
  locale: "ko";
  name: string;
  normalized_name: string;
  source_type: GachaProductNameCandidateSourceType;
  source_name: string;
  source_url: string | null;
  source_product_key: string | null;
  confidence: number | null;
  status: GachaProductNameCandidateStatus;
  is_primary: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
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
  availability_status: "available" | "sold_out" | "seen" | "unknown";
  lat: number | null;
  lng: number | null;
}
