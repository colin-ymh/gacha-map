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

export type GachaProductReleasePrecision =
  "exact" | "week" | "early" | "mid" | "late" | "month" | "unknown";

export interface GachaProduct {
  id: string;
  manufacturer: string;
  name: string;
  name_ja: string | null;
  name_ko: string | null;
  name_en: string | null;
  price_jpy: number | null;
  release_month: string | null;
  release_start_date?: string | null;
  release_end_date?: string | null;
  release_precision?: GachaProductReleasePrecision | null;
  official_image_url: string | null;
  status: "active" | "inactive";
  name_parts?: GachaProductNameParts | null;
  source_type?: "official" | "user_manual";
  /** 검색 결과일 때만 채워진다. search_gacha_products RPC 의 관련도 점수. */
  match_score?: number;
  /** 어느 필드에서 매칭됐는지. 검색 결과일 때만 채워진다. */
  match_kind?: GachaSearchMatchKind | null;
  /** match_kind 가 'variant' 일 때 실제로 걸린 변형(상세) 상품명. */
  matched_variant_name?: string | null;
}

/** search_gacha_products 가 돌려주는 매칭 종류. 점수가 높은 순. */
export type GachaSearchMatchKind =
  "exact" | "prefix" | "primary" | "code" | "series" | "variant" | "fuzzy";

/**
 * 검색어가 어떤 별칭으로 확장됐는지.
 * 예: alias='먼작귀', canonical_terms=['치이카와','ちいかわ']
 */
export interface GachaSearchAppliedAlias {
  alias: string;
  canonical_terms: string[];
}

// ── 카테고리·시리즈 탐색 ──────────────────────────────────────────────────────
// 노션 「가챠 카테고리·시리즈 탐색 기획」 참고.

export type GachaCategoryType =
  "product_type" | "subject" | "genre" | "line" | "origin";

/** gacha_series.kind. DB CHECK 도메인과 값이 일치해야 한다. */
export type GachaSeriesKind =
  | "anime"
  | "manga"
  | "game"
  | "character_brand"
  | "toy_line"
  | "franchise"
  | "other"
  | "unknown";

/**
 * 시리즈 목록 필터 칩. 'anime' 칩만 anime + manga 두 kind 를 묶는다.
 * toy_line 은 시리즈가 아니라 카테고리(line 축) 개념이라 칩에서 뺀다.
 */
export type GachaSeriesChip =
  "anime" | "other" | "character_brand" | "franchise" | "game";

export type GachaBrowseSort = "popular" | "recent" | "name";

export interface GachaBrowseCategory {
  category_id: string;
  name_ko: string;
  name_ja: string | null;
  name_en: string | null;
  category_type: GachaCategoryType;
  product_count: number;
  representative_image_url: string | null;
}

export interface GachaBrowseSeries {
  series_id: string;
  name_ko: string;
  name_ja: string | null;
  name_en: string | null;
  kind: GachaSeriesKind;
  parent_id: string | null;
  /** 0 = 루트, 1 = 자식. 계층은 2단이 상한이다. */
  depth: number;
  direct_product_count: number;
  /** 자손 상품을 합산한 수. 목록 정렬·노출 판정에 쓴다. */
  rollup_product_count: number;
  child_count: number;
  representative_image_url: string | null;
}

export interface GachaBrowseCategoriesResponse {
  categories: GachaBrowseCategory[];
}

export interface GachaBrowseSeriesResponse {
  series: GachaBrowseSeries[];
  total: number;
  offset: number;
  limit: number;
}

export interface GachaBrowseProductsResponse {
  products: GachaProductWithShops[];
  total: number;
  offset: number;
  limit: number;
}

/** GET /api/gacha-products 의 검색(q 있음) 응답. */
export interface GachaProductSearchResponse {
  products: GachaProductWithShops[];
  total: number;
  offset: number;
  limit: number;
  /** 적용된 별칭 목록. 없으면 빈 배열. */
  applied_aliases: GachaSearchAppliedAlias[];
}

export type ShopGachaProductSource = "user_report" | "shop_owner" | "admin";
export type ShopGachaProductAvailability =
  "available" | "sold_out" | "seen" | "unknown";

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
  is_mine: boolean;
  reported_by_nickname: string | null;
  unavailable_by_nickname: string | null;
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
  lat: number | null;
  lng: number | null;
  updated_at: string | null;
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
  "first_explorer" | "info_collector" | "gacha_hunter" | "gacha_doctor";

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
  // 쿼터 내역. base = 기본 일일 횟수, bonus = 친구 초대 + 리뷰/제보/가챠제보 보너스 합산,
  // used = 오늘 사용한 횟수. 서버 RPC가 계산한 값을 그대로 싣는다.
  base: number;
  bonus: number;
  used: number;
};

// roll-status가 이미 계산해 내려주는 쿼터 조각. nextAvailableAt은 없다.
export type GachaRollQuotaSummary = {
  base: number;
  bonus: number;
  used: number;
  remaining: number;
};

// 뽑기와 무관하게 잔여 횟수만 조회할 때 쓰는 형태 (GET /api/gacha/quota).
export type GachaDailyQuota = GachaRollQuotaSummary & {
  nextAvailableAt: string;
};

export type GachaRollVariantStat = {
  variantId: string;
  variantName: string;
  variantNameKo: string | null;
  variantImageUrl: string | null;
  count: number;
};

export type GachaRollStats = {
  totalCount: number;
  todayCount: number;
  variantStats: GachaRollVariantStat[];
};

export type GachaRollResult = {
  variant: GachaProductVariant;
  rollId: string;
  permission: GachaRollPermission;
  stats: GachaRollStats;
};

export type GachaCollectionSummary = {
  productId: string;
  productDisplayName: string;
  productImageUrl: string | null;
  totalVariants: number;
  collectedCount: number;
  isComplete: boolean;
};

export type GachaCollectionVariant = {
  variantId: string;
  variantName: string;
  variantNameKo: string | null;
  variantImageUrl: string | null;
  collected: boolean;
  count: number;
};

export type GachaCollectionDetail = {
  productId: string;
  totalVariants: number;
  collectedCount: number;
  isComplete: boolean;
  variants: GachaCollectionVariant[];
};
