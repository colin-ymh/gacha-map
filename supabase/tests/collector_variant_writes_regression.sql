-- Run through dev Supabase MCP. Every fixture and write is rolled back.
BEGIN;

DO $$
DECLARE
  product_id_fixture uuid := gen_random_uuid();
  user_id_fixture uuid;
  roll_id_fixture uuid;
  first_id uuid;
  second_id uuid;
  image_only_id uuid;
  fixture_url constant text := 'https://example.test/collector-fixture';
  cover_url constant text := 'https://example.test/collector-fixture/cover.png';
  ts timestamptz := clock_timestamp() - interval '1 minute';
  extraction jsonb;
  initial jsonb;
  reordered jsonb;
  promoted jsonb;
  snapshot jsonb;
  response jsonb;
  rejected boolean := false;
BEGIN
  INSERT INTO public.gacha_products (
    id, manufacturer, name, normalized_name, source_url, official_image_url
  ) VALUES (
    product_id_fixture, 'tarlin_international', '構成品回帰テスト',
    'collector-variant-regression-' || product_id_fixture::text, fixture_url, cover_url
  );

  extraction := jsonb_build_object(
    'method', 'regression_fixture', 'status', 'success', 'parser_version', 'fixture',
    'expected_count', 3, 'extracted_count', 3, 'image_count', 3, 'fetched_at', ts
  );
  initial := jsonb_build_array(
    jsonb_build_object('name', '原文 A', 'name_ja', '原文 A', 'normalized_name', 'first',
      'sort_order', 1, 'source_url', fixture_url, 'image_url', fixture_url || '/a.png'),
    jsonb_build_object('name_ja', '原文 B', 'normalized_name', 'second',
      'sort_order', 2, 'source_url', fixture_url, 'image_url', fixture_url || '/b.png'),
    jsonb_build_object('name_ja', NULL, 'normalized_name', 'image-only-3',
      'sort_order', 3, 'source_url', fixture_url, 'image_url', fixture_url || '/c.png',
      'raw_payload', '{"generated_name":true,"title_status":"unknown","ocr_evidence":"photo"}'::jsonb)
  );
  response := public.save_gacha_collector_variants(product_id_fixture, 'tarlin', initial, extraction);
  IF response->>'inserted' IS DISTINCT FROM '3' THEN
    RAISE EXCEPTION 'Initial lineup failed: %', response;
  END IF;
  SELECT id INTO STRICT first_id FROM public.gacha_product_variants
    WHERE product_id = product_id_fixture AND sort_order = 1;
  SELECT id INTO STRICT second_id FROM public.gacha_product_variants
    WHERE product_id = product_id_fixture AND sort_order = 2;
  SELECT id INTO STRICT image_only_id FROM public.gacha_product_variants
    WHERE product_id = product_id_fixture AND sort_order = 3;

  UPDATE public.gacha_product_variants
  SET name_ko = '첫 번째', name_en = 'First', raw_payload = '{"manual":true,"ko_translation":{"source":"manual"}}'
  WHERE id = first_id;
  UPDATE public.gacha_product_variants SET status = 'archived' WHERE id = second_id;
  SELECT id INTO user_id_fixture FROM auth.users ORDER BY id LIMIT 1;
  IF user_id_fixture IS NOT NULL THEN
    INSERT INTO public.gacha_roll_results (user_id, product_id, variant_id)
    VALUES (user_id_fixture, product_id_fixture, first_id) RETURNING id INTO roll_id_fixture;
  END IF;

  reordered := jsonb_build_array(
    jsonb_set(initial->1, '{sort_order}', '1'),
    jsonb_set(jsonb_set(initial->2, '{sort_order}', '2'), '{normalized_name}', '"image-only-2"'),
    jsonb_set(jsonb_set(initial->0, '{sort_order}', '3'), '{name_ja}', '" 原文  A "')
  );
  extraction := extraction || jsonb_build_object('fetched_at', ts + interval '1 second');
  response := public.save_gacha_collector_variants(product_id_fixture, 'tarlin', reordered, extraction);
  IF response->>'inserted' IS DISTINCT FROM '0'
     OR NOT EXISTS (SELECT 1 FROM public.gacha_product_variants WHERE id = first_id AND sort_order = 3
                    AND name_ja = '原文 A' AND name_ko = '첫 번째' AND name_en = 'First'
                    AND raw_payload @> '{"manual":true,"ko_translation":{"source":"manual"}}')
     OR NOT EXISTS (SELECT 1 FROM public.gacha_product_variants WHERE id = second_id AND sort_order = 1 AND status = 'archived')
     OR NOT EXISTS (SELECT 1 FROM public.gacha_product_variants WHERE id = image_only_id AND sort_order = 2)
     OR (roll_id_fixture IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.gacha_roll_results WHERE id = roll_id_fixture AND variant_id = first_id
     )) THEN
    RAISE EXCEPTION 'Reorder lost identity, metadata or references: %', response;
  END IF;
  response := public.save_gacha_collector_variants(product_id_fixture, 'tarlin', reordered, extraction);
  IF response->>'inserted' IS DISTINCT FROM '0' OR response->>'updated' IS DISTINCT FROM '0' THEN
    RAISE EXCEPTION 'Repeated lineup updated variants: %', response;
  END IF;

  promoted := (reordered->1) || jsonb_build_object(
    'name_ja', '原文 C', 'normalized_name', 'third', 'sort_order', 1,
    'expected_variant_id', image_only_id,
    'raw_payload', '{"generated_name":false,"title_status":"apple_vision_ocr"}'::jsonb
  );
  extraction := extraction || jsonb_build_object(
    'fetched_at', ts + interval '2 seconds', 'expected_fetched_at', ts + interval '1 second',
    'status', 'partial', 'extracted_count', 1
  );
  response := public.save_gacha_collector_variants(product_id_fixture, 'tarlin', jsonb_build_array(promoted), extraction);
  IF response->>'status' IS DISTINCT FROM 'applied'
     OR NOT EXISTS (SELECT 1 FROM public.gacha_product_variants WHERE id = image_only_id AND sort_order = 2
                    AND name_ja = '原文 C' AND normalized_name = 'third'
                    AND raw_payload @> '{"generated_name":false,"title_status":"apple_vision_ocr","ocr_evidence":"photo"}')
     OR (SELECT count(*) FROM public.gacha_product_variants WHERE product_id = product_id_fixture) <> 3 THEN
    RAISE EXCEPTION 'Partial image promotion did not preserve the lineup: %', response;
  END IF;

  IF NOT public.save_gacha_collector_variant_translation(first_id, '原文 A', '첫 번째', '정정된 번역', '{"source":"review"}') THEN
    RAISE EXCEPTION 'Valid translation was not saved';
  END IF;
  IF public.save_gacha_collector_variant_translation(first_id, '原文 A', '첫 번째', '오래된 번역', '{}')
     OR public.save_gacha_collector_variant_translation(first_id, '다른 원문', '정정된 번역', '불일치', '{}')
     OR public.save_gacha_collector_variant_translation(second_id, '原文 B', NULL, '숨겨진 항목', '{}') THEN
    RAISE EXCEPTION 'Invalid translation precondition was accepted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gacha_product_variants WHERE id = first_id AND name_ko = '정정된 번역'
                 AND raw_payload @> '{"manual":true,"ko_translation":{"source":"review"}}') THEN
    RAISE EXCEPTION 'Translation metadata merge failed';
  END IF;

  response := public.save_gacha_collector_variants(product_id_fixture, 'tarlin', initial, extraction);
  IF response->>'reason' IS DISTINCT FROM 'stale_extraction' THEN
    RAISE EXCEPTION 'Outdated expected extraction snapshot was accepted: %', response;
  END IF;
  response := public.save_gacha_collector_variants(
    product_id_fixture, 'tarlin', initial,
    (extraction - 'expected_fetched_at') || jsonb_build_object('fetched_at', ts)
  );
  IF response->>'reason' IS DISTINCT FROM 'stale_extraction' THEN
    RAISE EXCEPTION 'Older observation time was accepted: %', response;
  END IF;

  SELECT jsonb_agg(to_jsonb(v) ORDER BY id) INTO snapshot FROM public.gacha_product_variants v
    WHERE v.product_id = product_id_fixture;
  extraction := (extraction - 'expected_fetched_at') || jsonb_build_object('fetched_at', ts + interval '3 seconds', 'status', 'success');
  response := public.save_gacha_collector_variants(
    product_id_fixture, 'tarlin',
    jsonb_build_array(promoted || jsonb_build_object('expected_variant_id', gen_random_uuid())), extraction
  );
  IF response->>'reason' IS DISTINCT FROM 'stale_variant' THEN
    RAISE EXCEPTION 'Stale variant identity was accepted: %', response;
  END IF;
  response := public.save_gacha_collector_variants(
    product_id_fixture, 'tarlin',
    jsonb_build_array((initial->0) || jsonb_build_object('image_url', fixture_url || '/b.png')), extraction
  );
  IF response->>'reason' IS DISTINCT FROM 'ambiguous_identity'
     OR NOT EXISTS (SELECT 1 FROM public.gacha_product_variant_extraction_results
                    WHERE product_id = product_id_fixture AND source_name = 'tarlin' AND status = 'partial'
                      AND raw_payload->>'collector_lineup_review' = 'ambiguous_identity') THEN
    RAISE EXCEPTION 'Conflicting name and image did not preserve review evidence: %', response;
  END IF;
  response := public.save_gacha_collector_variants(
    product_id_fixture, 'tarlin',
    jsonb_build_array((initial->0) || jsonb_build_object('name_ja', '未知', 'image_url', fixture_url || '/unknown.png')), extraction
  );
  IF response->>'reason' IS DISTINCT FROM 'unmatched_existing_variants' THEN
    RAISE EXCEPTION 'Unmatched replacement was accepted: %', response;
  END IF;
  response := public.save_gacha_collector_variants(
    product_id_fixture, 'tarlin',
    jsonb_build_array((initial->2) || jsonb_build_object('image_url', cover_url)), extraction
  );
  IF response->>'reason' IS DISTINCT FROM 'missing_variant_identity' THEN
    RAISE EXCEPTION 'Cover was accepted as a variant identity: %', response;
  END IF;

  response := public.save_gacha_collector_variants(
    product_id_fixture, 'another-source', jsonb_build_array(initial->0), extraction
  );
  IF response->>'reason' IS DISTINCT FROM 'normalized_name_collision' THEN
    RAISE EXCEPTION 'Cross-source normalized-name collision was accepted: %', response;
  END IF;
  response := public.save_gacha_collector_variants(
    product_id_fixture, 'tarlin', initial,
    extraction || jsonb_build_object('status', 'failed', 'error_message', 'fixture')
  );
  IF response->>'updated' IS DISTINCT FROM '0'
     OR NOT EXISTS (SELECT 1 FROM public.gacha_product_variant_extraction_results
                    WHERE product_id = product_id_fixture AND source_name = 'tarlin'
                      AND status = 'failed' AND error_message = 'fixture') THEN
    RAISE EXCEPTION 'Failed extraction changed the lineup or was lost: %', response;
  END IF;
  PERFORM public.save_gacha_collector_variants(
    product_id_fixture, 'tarlin', '[]',
    extraction || jsonb_build_object('status', 'no_lineup_found')
  );
  IF (SELECT jsonb_agg(to_jsonb(v) ORDER BY id)
      FROM public.gacha_product_variants v WHERE v.product_id = product_id_fixture) IS DISTINCT FROM snapshot THEN
    RAISE EXCEPTION 'Review, failed or empty input changed existing variants';
  END IF;

  BEGIN
    PERFORM public.save_gacha_collector_variants(
      product_id_fixture, 'tarlin', initial,
      extraction || jsonb_build_object('extracted_count', -1, 'fetched_at', ts + interval '4 seconds')
    );
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;
  IF NOT rejected
     OR (SELECT jsonb_agg(to_jsonb(v) ORDER BY id)
         FROM public.gacha_product_variants v WHERE v.product_id = product_id_fixture) IS DISTINCT FROM snapshot
     OR NOT EXISTS (SELECT 1 FROM public.gacha_product_variant_extraction_results
                    WHERE product_id = product_id_fixture AND source_name = 'tarlin'
                      AND status = 'no_lineup_found' AND fetched_at = ts + interval '3 seconds') THEN
    RAISE EXCEPTION 'Extraction constraint failure did not roll back the lineup transaction';
  END IF;

  IF has_function_privilege('anon', 'public.save_gacha_collector_variants(uuid,text,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.save_gacha_collector_variants(uuid,text,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.save_gacha_collector_variant_translation(uuid,text,text,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.save_gacha_collector_variant_translation(uuid,text,text,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.gacha_collector_variant_write_version()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.gacha_collector_variant_write_version()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.save_gacha_collector_variants(uuid,text,jsonb,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.save_gacha_collector_variant_translation(uuid,text,text,text,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.gacha_collector_variant_write_version()', 'EXECUTE')
     OR public.gacha_collector_variant_write_version() <> 1 THEN
    RAISE EXCEPTION 'Collector variant write role mismatch';
  END IF;
END;
$$;

ROLLBACK;
SELECT 'collector variant rollback regression passed' AS result;
