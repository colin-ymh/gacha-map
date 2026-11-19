-- Run in an empty, isolated database after applying the featured migrations.
BEGIN;

DO $test$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_utc_midnight timestamptz := v_today::timestamp AT TIME ZONE 'Asia/Seoul';
  v_products uuid[];
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_first uuid[];
  v_repeat uuid[];
  v_whitespace text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.gacha_products)
     OR EXISTS (SELECT 1 FROM public.daily_featured_gacha) THEN
    RAISE EXCEPTION 'This regression requires an empty test catalog';
  END IF;

  SELECT array_agg(gen_random_uuid() ORDER BY n) INTO v_products
  FROM generate_series(1, 18) AS n;

  INSERT INTO auth.users (id) VALUES (v_user_a), (v_user_b);
  INSERT INTO public.gacha_products
    (id, manufacturer, name, normalized_name, name_ja, name_ko,
     official_image_url, source_url, featured_week_start)
  SELECT v_products[n], 'featured_fixture', '原文', 'featured-' || n, '原文',
    CASE n
      WHEN 12 THEN 'POKÉMON'
      WHEN 13 THEN NULL
      WHEN 14 THEN E' \t '
      WHEN 15 THEN '한국어 カプセル'
      WHEN 16 THEN '商品'
      WHEN 17 THEN 'ｶﾞﾁｬ'
      ELSE '가챠 ' || n
    END,
    CASE WHEN n <> 18 THEN 'https://example.test/cover/' || n END,
    'https://example.test/product/' || n,
    date_trunc('week', v_today)::date
  FROM generate_series(1, 18) AS n;

  INSERT INTO public.gacha_product_variants
    (product_id, name, normalized_name, name_ja, image_url, sort_order, source_name, source_url, status)
  SELECT v_products[n], '품목', 'fixture-item', '品目', 'https://example.test/item/' || n,
    1, 'featured_fixture', 'https://example.test/product/' || n, 'active'
  FROM generate_series(1, 18) AS n
  WHERE n <> 11;
  INSERT INTO public.gacha_product_variants
    (product_id, name, normalized_name, name_ja, image_url, sort_order, source_name, source_url, status)
  VALUES (v_products[11], '품목', 'fixture-item-no-image', '品目', NULL,
    1, 'featured_fixture', 'https://example.test/product/11', 'active');

  INSERT INTO public.daily_featured_gacha (featured_date, product_id, rank, slot_type) VALUES
    (v_today - 1, v_products[2], 1, 'random'),
    (v_today - 7, v_products[3], 1, 'popular'),
    (v_today - 8, v_products[4], 1, 'popular'),
    (v_today, v_products[1], 1, 'random'),
    (v_today, v_products[13], 2, 'random'),
    (v_today, v_products[14], 3, 'random'),
    (v_today, v_products[15], 4, 'random'),
    (v_today, v_products[16], 5, 'random'),
    (v_today, v_products[17], 6, 'random'),
    (v_today, v_products[10], 7, 'random'),
    (v_today, v_products[11], 8, 'random'),
    (v_today, v_products[18], 9, 'random');

  INSERT INTO public.product_wishlists (product_id, user_id, created_at)
  SELECT v_products[n], accounts.uid, v_utc_midnight
  FROM unnest(ARRAY[2, 3, 5, 9, 13, 15]) AS n
  CROSS JOIN unnest(ARRAY[v_user_a, v_user_b]) AS accounts(uid);
  INSERT INTO public.product_wishlists (product_id, user_id, created_at)
  VALUES (v_products[6], v_user_a, v_utc_midnight);

  UPDATE public.product_wishlists SET created_at = v_utc_midnight + interval '24 hours'
  WHERE product_id = v_products[9];
  INSERT INTO public.gacha_roll_results (product_id, variant_id, user_id, rolled_at)
  SELECT v.product_id, v.id, accounts.uid, v_utc_midnight
  FROM public.gacha_product_variants v
  CROSS JOIN unnest(ARRAY[v_user_a, v_user_b]) AS accounts(uid)
  WHERE v.product_id = v_products[4];
  INSERT INTO public.gacha_roll_results (product_id, variant_id, user_id, rolled_at)
  SELECT v.product_id, v.id, v_user_a, v_utc_midnight
  FROM public.gacha_product_variants v
  WHERE v.product_id = v_products[6];

  IF (SELECT count(*) FROM public.get_daily_featured_gacha(v_today, 0)) <> 0
     OR (SELECT count(*) FROM public.daily_featured_gacha WHERE featured_date = v_today) <> 9 THEN
    RAISE EXCEPTION 'Zero-limit request changed today';
  END IF;

  IF (SELECT count(*) FROM public.get_daily_featured_gacha(v_today, 1)) <> 1 THEN
    RAISE EXCEPTION 'One-item response exceeded the requested limit';
  END IF;

  SELECT array_agg(id ORDER BY rank) INTO v_first
  FROM public.get_daily_featured_gacha(p_count => 10);
  SELECT array_agg(id ORDER BY rank) INTO v_repeat
  FROM public.get_daily_featured_gacha(p_count => 10);

  -- Only nine products were unseen over seven days. The final slot goes to
  -- the oldest repeat, even though yesterday's repeat has popularity signals.
  IF cardinality(v_first) IS DISTINCT FROM 10 OR v_first IS DISTINCT FROM v_repeat
     OR v_first[1] <> v_products[1] OR v_first[7] <> v_products[10]
     OR v_first[2] <> v_products[5] OR v_first[3] <> v_products[4]
     OR v_first[10] <> v_products[3]
     OR NOT v_products[12] = ANY(v_first)
     OR v_products[2] = ANY(v_first)
     OR EXISTS (SELECT 1 FROM unnest(v_first) AS accepted WHERE accepted = ANY(v_products[13:18])) THEN
    RAISE EXCEPTION 'Daily rotation, replacement, name filtering or rank stability failed';
  END IF;

  IF (SELECT count(*) FROM public.daily_featured_gacha
      WHERE featured_date = v_today AND slot_type = 'popular') <> 2 THEN
    RAISE EXCEPTION 'Two-user and KST activity limits were bypassed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.get_new_arrival_gacha(v_today, 50))
     OR EXISTS (
       SELECT 1 FROM public.get_new_arrival_gacha(v_today, 50) a WHERE a.id = ANY(v_first)
     ) THEN
    RAISE EXCEPTION 'This week and daily selections overlapped';
  END IF;

  -- Add one fresh eligible candidate and simulate a fresh draw for today.
  UPDATE public.gacha_product_variants
  SET image_url = 'https://example.test/item/11'
  WHERE product_id = v_products[11];
  DELETE FROM public.daily_featured_gacha WHERE featured_date = v_today;
  IF (SELECT count(*) FROM public.get_daily_featured_gacha(v_today)) <> 10
     OR EXISTS (SELECT 1 FROM public.daily_featured_gacha
                WHERE featured_date = v_today AND product_id IN (v_products[2], v_products[3])) THEN
    RAISE EXCEPTION 'Recent picks leaked despite ten fresh options';
  END IF;

  IF (SELECT count(*) FROM public.get_daily_featured_gacha(v_today + 1)) <> 0
     OR (SELECT count(*) FROM public.get_daily_featured_gacha(v_today - 1)) <> 1
     OR EXISTS (SELECT 1 FROM public.daily_featured_gacha WHERE featured_date = v_today + 1) THEN
    RAISE EXCEPTION 'Historical or future date contract changed';
  END IF;

  -- Every ASCII control-space must remain ineligible on both the cleanup and
  -- cold generation paths; URL checks must not accept whitespace as an image.
  FOREACH v_whitespace IN ARRAY ARRAY[E' \t\n\r\f\013', ''] LOOP
    UPDATE public.gacha_products SET name_ko = v_whitespace WHERE id = v_products[13];
    UPDATE public.gacha_products SET official_image_url = v_whitespace WHERE id = v_products[18];
    UPDATE public.gacha_product_variants SET image_url = v_whitespace WHERE product_id = v_products[11];
    DELETE FROM public.daily_featured_gacha WHERE featured_date = v_today;
    PERFORM * FROM public.get_daily_featured_gacha(v_today);
    IF EXISTS (SELECT 1 FROM public.daily_featured_gacha
               WHERE featured_date = v_today AND product_id IN (v_products[11], v_products[13], v_products[18])) THEN
      RAISE EXCEPTION 'Whitespace names or image URLs became eligible';
    END IF;
  END LOOP;
  UPDATE public.gacha_product_variants SET image_url = 'https://example.test/item/11'
  WHERE product_id = v_products[11];

  DELETE FROM public.product_wishlists;
  DELETE FROM public.gacha_roll_results;
  DELETE FROM public.daily_featured_gacha WHERE featured_date = v_today;
  IF (SELECT count(*) FROM public.get_daily_featured_gacha(v_today)) <> 10
     OR EXISTS (SELECT 1 FROM public.daily_featured_gacha
                WHERE featured_date = v_today AND slot_type = 'popular') THEN
    RAISE EXCEPTION 'No-engagement fallback did not fill all positions';
  END IF;
END;
$test$;

SET LOCAL ROLE anon;
SELECT count(*) AS anon_featured_count FROM public.get_daily_featured_gacha(p_count => 10);
ROLLBACK;
