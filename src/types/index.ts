export type ShopStatus = 'pending' | 'approved' | 'rejected'
export type ReportStatus = 'pending' | 'reviewed' | 'resolved'

export interface Shop {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  description: string | null
  tags: string[]
  image_urls: string[]
  status: ShopStatus
  reported_by: string | null
  created_at: string
  updated_at: string
}

export interface Report {
  id: string
  shop_id: string | null
  reporter_name: string | null
  reporter_contact: string | null
  content: string
  status: ReportStatus
  created_at: string
}

export interface Wishlist {
  id: string
  user_id: string
  shop_id: string
  created_at: string
}
