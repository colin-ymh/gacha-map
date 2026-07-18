ALTER TABLE public.shop_gacha_products
  ADD COLUMN IF NOT EXISTS unavailable_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unavailable_at timestamptz;
