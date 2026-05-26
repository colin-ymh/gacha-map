CREATE TABLE IF NOT EXISTS public.gacha_products (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer       text        NOT NULL,
  name               text        NOT NULL,
  normalized_name    text        NOT NULL,
  name_ja            text,
  name_ko            text,
  name_en            text,
  jan_code           text,
  product_code       text,
  price_jpy          integer,
  release_month      date,
  release_week_text  text,
  types_count        integer,
  official_image_url text,
  source_url         text        NOT NULL,
  source_type        text        NOT NULL DEFAULT 'official'
                              CHECK (source_type IN ('official')),
  status             text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'hidden', 'archived')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gacha_product_sources (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         uuid        NOT NULL REFERENCES public.gacha_products(id) ON DELETE CASCADE,
  source_name        text        NOT NULL,
  source_url         text        NOT NULL,
  source_product_key text        NOT NULL,
  raw_name           text        NOT NULL,
  raw_price_text     text,
  raw_release_text   text,
  raw_image_url      text,
  fetched_at         timestamptz NOT NULL DEFAULT now(),
  content_hash       text        NOT NULL
);

CREATE TABLE IF NOT EXISTS public.shop_gacha_products (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  gacha_product_id    uuid        NOT NULL REFERENCES public.gacha_products(id) ON DELETE CASCADE,
  availability_status text        NOT NULL DEFAULT 'seen'
                               CHECK (availability_status IN ('seen', 'available', 'sold_out', 'unknown')),
  source              text        NOT NULL DEFAULT 'user_report'
                               CHECK (source IN ('user_report', 'shop_owner', 'admin')),
  reported_by         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_by         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, gacha_product_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS gacha_products_jan_code_key
  ON public.gacha_products(jan_code)
  WHERE jan_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gacha_products_manufacturer_product_code_key
  ON public.gacha_products(manufacturer, product_code)
  WHERE product_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gacha_products_fallback_key
  ON public.gacha_products(manufacturer, normalized_name, release_month);

CREATE UNIQUE INDEX IF NOT EXISTS gacha_product_sources_source_key
  ON public.gacha_product_sources(source_name, source_product_key);

CREATE INDEX IF NOT EXISTS gacha_products_status_idx
  ON public.gacha_products(status);

CREATE INDEX IF NOT EXISTS gacha_products_manufacturer_idx
  ON public.gacha_products(manufacturer);

CREATE INDEX IF NOT EXISTS gacha_products_search_idx
  ON public.gacha_products USING gin (
    to_tsvector(
      'simple',
      coalesce(name, '') || ' ' ||
      coalesce(name_ja, '') || ' ' ||
      coalesce(name_en, '') || ' ' ||
      coalesce(jan_code, '') || ' ' ||
      coalesce(product_code, '')
    )
  );

CREATE INDEX IF NOT EXISTS gacha_product_sources_product_id_idx
  ON public.gacha_product_sources(product_id);

CREATE INDEX IF NOT EXISTS shop_gacha_products_shop_id_idx
  ON public.shop_gacha_products(shop_id);

CREATE INDEX IF NOT EXISTS shop_gacha_products_product_id_idx
  ON public.shop_gacha_products(gacha_product_id);

CREATE TRIGGER gacha_products_updated_at
  BEFORE UPDATE ON public.gacha_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER shop_gacha_products_updated_at
  BEFORE UPDATE ON public.shop_gacha_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.gacha_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_product_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_gacha_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can view active gacha_products"
  ON public.gacha_products
  FOR SELECT
  USING (status = 'active');

CREATE POLICY "admins can manage gacha_products"
  ON public.gacha_products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "admins can manage gacha_product_sources"
  ON public.gacha_product_sources
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "public can view shop_gacha_products"
  ON public.shop_gacha_products
  FOR SELECT
  USING (true);

CREATE POLICY "users can insert own shop_gacha_products"
  ON public.shop_gacha_products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reported_by
    AND source IN ('user_report', 'shop_owner')
    AND verified_by IS NULL
    AND verified_at IS NULL
  );

CREATE POLICY "users can update own shop_gacha_products"
  ON public.shop_gacha_products
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = reported_by)
  WITH CHECK (
    auth.uid() = reported_by
    AND source IN ('user_report', 'shop_owner')
    AND verified_by IS NULL
    AND verified_at IS NULL
  );

CREATE POLICY "admins can manage shop_gacha_products"
  ON public.shop_gacha_products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
