-- validate_shop_gacha_product_variant_product() only exists where the
-- shop_gacha_products <-> gacha_product_variants linkage feature was
-- deployed (dev only, unused in app code). Guard so this migration is
-- safe to run on environments without that function.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'validate_shop_gacha_product_variant_product'
  ) THEN
    ALTER FUNCTION public.validate_shop_gacha_product_variant_product()
      SET search_path = public, pg_temp;
  END IF;
END $$;

drop policy if exists "public can view active gacha_product_variants" on public.gacha_product_variants;
drop policy if exists "admins can manage gacha_product_variants" on public.gacha_product_variants;

create policy "public and admins can view gacha_product_variants"
  on public.gacha_product_variants
  for select
  using (
    (
      status = 'active'::text
      and exists (
        select 1
        from public.gacha_products
        where gacha_products.id = gacha_product_variants.product_id
          and gacha_products.status = 'active'::text
      )
    )
    or exists (
      select 1
      from public.user_profiles
      where user_profiles.id = (select auth.uid())
        and user_profiles.role = 'admin'::text
    )
  );

create policy "admins can insert gacha_product_variants"
  on public.gacha_product_variants
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_profiles
      where user_profiles.id = (select auth.uid())
        and user_profiles.role = 'admin'::text
    )
  );

create policy "admins can update gacha_product_variants"
  on public.gacha_product_variants
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles
      where user_profiles.id = (select auth.uid())
        and user_profiles.role = 'admin'::text
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles
      where user_profiles.id = (select auth.uid())
        and user_profiles.role = 'admin'::text
    )
  );

create policy "admins can delete gacha_product_variants"
  on public.gacha_product_variants
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles
      where user_profiles.id = (select auth.uid())
        and user_profiles.role = 'admin'::text
    )
  );
