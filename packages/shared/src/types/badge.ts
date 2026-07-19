export type BadgeTrack =
  | "quick_report"
  | "shop_review"
  | "new_shop_report"
  | "closed_shop_report"
  | "fix_info_report"
  | "wishlist"
  | "gacha_roll_variety"
  | "gacha_roll_days"
  | "operator"
  | "admin";

export type BadgeTier = 1 | 2 | 3;

export interface BadgeDefinition {
  id: string;
  track: BadgeTrack;
  tier: BadgeTier;
  name: string;
  description: string;
  icon_url: string;
  threshold: number;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_definition_id: string;
  earned_at: string;
  badge_definitions: BadgeDefinition;
}

export interface BadgeCountLogEntry {
  user_id: string;
  shop_id: string;
  action_type: BadgeTrack;
  week_start: string;
}

export type AbuseFlagType =
  "burst_activity" | "new_account_rapid_achievement" | "price_anomaly";

export interface AbuseFlag {
  id: string;
  user_id: string;
  flag_type: AbuseFlagType;
  detail: Record<string, unknown>;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface MainBadge {
  id: string;
  name: string;
  icon_url: string;
}
