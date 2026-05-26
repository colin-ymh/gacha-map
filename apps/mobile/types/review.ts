export interface Review {
  id: string;
  shop_id: string;
  user_id: string;
  content: string | null;
  image_urls: string[];
  created_at: string;
  updated_at: string;
  user: { nickname: string | null; avatar_url: string | null } | null;
}
