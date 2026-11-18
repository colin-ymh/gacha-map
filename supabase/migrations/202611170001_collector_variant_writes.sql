BEGIN;

CREATE OR REPLACE FUNCTION public.save_gacha_collector_variants(
  p_product_id uuid,
  p_source_name text,
  p_variants jsonb,
  p_extraction jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_cover text;
  v_version text;
  v_status text;
  v_fetched_at timestamptz;
  v_stored_at timestamptz;
  v_raw jsonb;
  v_review text;
  v_input record;
  v_variant public.gacha_product_variants%ROWTYPE;
  v_existing_count integer;
  v_max_order integer;
  v_keep_order boolean;
  v_name_ids uuid[];
  v_image_ids uuid[];
  v_match uuid;
  v_name_match uuid;
  v_image_match uuid;
  v_matched uuid[] := '{}';
  v_plan jsonb := '[]';
  v_moved uuid[];
  v_sort_base integer;
  v_inserted integer := 0;
  v_updated integer := 0;
BEGIN
  IF p_product_id IS NULL OR nullif(btrim(p_source_name), '') IS NULL
     OR jsonb_typeof(p_variants) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid collector lineup input';
  END IF;
  IF jsonb_array_length(p_variants) > 200
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_variants) AS item
       WHERE jsonb_typeof(item) <> 'object'
          OR coalesce(jsonb_typeof(item->'sort_order'), 'missing') <> 'number'
          OR item->>'sort_order' !~ '^[1-9][0-9]{0,5}$'
          OR coalesce(jsonb_typeof(item->'source_url'), 'missing') <> 'string'
          OR nullif(btrim(item->>'source_url'), '') IS NULL
          OR coalesce(jsonb_typeof(item->'normalized_name'), 'missing') <> 'string'
          OR nullif(btrim(item->>'normalized_name'), '') IS NULL
          OR coalesce(jsonb_typeof(item->'name'), 'null') NOT IN ('null', 'string')
          OR coalesce(jsonb_typeof(item->'name_ja'), 'null') NOT IN ('null', 'string')
          OR coalesce(jsonb_typeof(item->'image_url'), 'null') NOT IN ('null', 'string')
          OR coalesce(jsonb_typeof(item->'expected_variant_id'), 'null') NOT IN ('null', 'string')
          OR coalesce(jsonb_typeof(item->'raw_payload'), 'null') NOT IN ('null', 'object')
     )
     OR (SELECT count(DISTINCT item->>'sort_order') FROM jsonb_array_elements(p_variants) AS item)
        <> jsonb_array_length(p_variants) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Malformed or duplicate collector lineup positions';
  END IF;

  IF p_extraction IS NOT NULL THEN
    v_version := p_extraction->>'parser_version';
    v_status := p_extraction->>'status';
    IF jsonb_typeof(p_extraction) IS DISTINCT FROM 'object'
       OR nullif(btrim(v_version), '') IS NULL
       OR nullif(btrim(p_extraction->>'method'), '') IS NULL
       OR v_status IS NULL
       OR v_status NOT IN ('success', 'partial', 'failed', 'needs_ocr', 'no_lineup_found')
       OR coalesce(jsonb_typeof(p_extraction->'raw_payload'), 'null') NOT IN ('null', 'object') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid collector extraction result';
    END IF;
    v_fetched_at := coalesce((p_extraction->>'fetched_at')::timestamptz, clock_timestamp());
    v_raw := nullif(p_extraction->'raw_payload', 'null'::jsonb);
  END IF;

  -- A parent lock serializes collector writes and prevents a concurrent FK insert.
  SELECT nullif(btrim(official_image_url), '') INTO v_cover
  FROM public.gacha_products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Collector product does not exist';
  END IF;

  IF p_extraction IS NOT NULL THEN
    SELECT max(fetched_at) INTO v_stored_at
    FROM public.gacha_product_variant_extraction_results
    WHERE product_id = p_product_id AND source_name = p_source_name;
    IF (p_extraction->>'fetched_at' IS NOT NULL AND v_stored_at > v_fetched_at)
       OR (p_extraction ? 'expected_fetched_at'
           AND (p_extraction->>'expected_fetched_at')::timestamptz IS DISTINCT FROM (
             SELECT fetched_at FROM public.gacha_product_variant_extraction_results
             WHERE product_id = p_product_id AND source_name = p_source_name AND parser_version = v_version
           )) THEN
      RETURN jsonb_build_object('status', 'review_required', 'reason', 'stale_extraction');
    END IF;
  END IF;

  IF jsonb_array_length(p_variants) > 0
     AND coalesce(v_status, 'success') IN ('success', 'partial') THEN
    PERFORM 1 FROM public.gacha_product_variants
    WHERE product_id = p_product_id
    ORDER BY id FOR UPDATE;
    SELECT count(*), coalesce(max(sort_order), 0)
    INTO v_existing_count, v_max_order
    FROM public.gacha_product_variants
    WHERE product_id = p_product_id AND source_name = p_source_name;

    FOR v_input IN
      SELECT fields.*, count(*) OVER (PARTITION BY name_key) AS same_name_count,
             count(*) OVER (PARTITION BY image_key) AS same_image_count
      FROM (
        SELECT r.*, nullif(lower(btrim(regexp_replace(name_ja, '[[:space:]]+', ' ', 'g'))), '') AS name_key,
               CASE WHEN nullif(btrim(image_url), '') IS DISTINCT FROM v_cover
                    THEN nullif(btrim(image_url), '') END AS image_key
        FROM jsonb_to_recordset(p_variants) AS r(
          name text, name_ja text, normalized_name text, image_url text,
          sort_order integer, source_url text, raw_payload jsonb, expected_variant_id uuid
        )
      ) AS fields
      ORDER BY sort_order
    LOOP
      IF v_input.name_key IS NULL AND v_input.image_key IS NULL THEN
        v_review := 'missing_variant_identity';
        EXIT;
      END IF;

      SELECT coalesce(array_agg(id) FILTER (WHERE v_input.name_key IS NOT NULL AND v_input.name_key =
                      nullif(lower(btrim(regexp_replace(name_ja, '[[:space:]]+', ' ', 'g'))), '')), '{}'),
             coalesce(array_agg(id) FILTER (WHERE btrim(image_url) = v_input.image_key), '{}')
      INTO v_name_ids, v_image_ids
      FROM public.gacha_product_variants
      WHERE product_id = p_product_id AND source_name = p_source_name;

      v_name_match := CASE WHEN v_input.same_name_count = 1 AND cardinality(v_name_ids) = 1
                           THEN v_name_ids[1] END;
      v_image_match := CASE WHEN v_input.same_image_count = 1 AND cardinality(v_image_ids) = 1
                            THEN v_image_ids[1] END;
      v_match := coalesce(v_name_match, v_image_match);
      IF v_input.expected_variant_id IS NOT NULL AND v_match IS DISTINCT FROM v_input.expected_variant_id THEN
        v_review := 'stale_variant';
        EXIT;
      END IF;
      IF (v_match IS NULL AND (cardinality(v_name_ids) > 0 OR cardinality(v_image_ids) > 0))
         OR (v_match IS NOT NULL AND (
           (cardinality(v_image_ids) > 0 AND NOT v_match = ANY(v_image_ids))
           OR (cardinality(v_name_ids) > 0 AND NOT v_match = ANY(v_name_ids))
           OR v_match = ANY(v_matched)
         )) THEN
        v_review := 'ambiguous_identity';
        EXIT;
      END IF;

      IF v_match IS NOT NULL THEN
        SELECT * INTO STRICT v_variant FROM public.gacha_product_variants WHERE id = v_match;
        IF v_input.name_key IS NOT NULL
           AND nullif(btrim(v_variant.name_ja), '') IS NOT NULL
           AND NOT v_match = ANY(v_name_ids) THEN
          v_review := 'conflicting_names';
          EXIT;
        END IF;
        v_matched := array_append(v_matched, v_match);
      END IF;
      v_plan := v_plan || jsonb_build_array(to_jsonb(v_input) || jsonb_build_object('match_id', v_match));
    END LOOP;

    IF v_review IS NULL AND cardinality(v_matched) < v_existing_count
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_plan) AS row WHERE row->>'match_id' IS NULL) THEN
      v_review := 'unmatched_existing_variants';
    END IF;

    -- Existing names and source keys are stable across official reorder. A partial
    -- snapshot keeps existing display positions, even when all rows were identified.
    v_keep_order := v_existing_count > 0
      AND (cardinality(v_matched) < v_existing_count OR v_status IS NOT DISTINCT FROM 'partial');
    IF v_review IS NULL THEN
      SELECT jsonb_agg(to_jsonb(plan) ORDER BY plan.sort_order) INTO v_plan
      FROM (
        SELECT r.match_id, r.name, r.name_ja, r.image_url, r.source_url, r.raw_payload,
          CASE WHEN v_keep_order AND r.match_id IS NOT NULL THEN old.sort_order
               WHEN v_keep_order THEN v_max_order + row_number() OVER (ORDER BY r.sort_order)
               ELSE r.sort_order END AS sort_order,
          CASE WHEN old.id IS NOT NULL AND (
                 nullif(btrim(old.name_ja), '') IS NOT NULL OR nullif(btrim(r.name_ja), '') IS NULL
               ) THEN old.normalized_name
               ELSE r.normalized_name END AS normalized_name,
          old.normalized_name IS DISTINCT FROM CASE
            WHEN old.id IS NOT NULL AND (
              nullif(btrim(old.name_ja), '') IS NOT NULL OR nullif(btrim(r.name_ja), '') IS NULL
            ) THEN old.normalized_name ELSE r.normalized_name
          END AS changes_normalized_name
        FROM jsonb_to_recordset(v_plan) AS r(
          match_id uuid, name text, name_ja text, normalized_name text, image_url text,
          sort_order integer, source_url text, raw_payload jsonb
        )
        LEFT JOIN public.gacha_product_variants old ON old.id = r.match_id
      ) AS plan;

      -- Dev additionally enforces an all-sources normalized-name index.
      IF EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(v_plan) AS planned(match_id uuid, normalized_name text, changes_normalized_name boolean)
        WHERE planned.changes_normalized_name AND (
          EXISTS (
            SELECT 1 FROM public.gacha_product_variants v
            WHERE v.product_id = p_product_id AND v.id IS DISTINCT FROM planned.match_id
              AND v.normalized_name = planned.normalized_name
          ) OR (SELECT count(*) FROM jsonb_array_elements(v_plan) AS row
                WHERE row->>'normalized_name' = planned.normalized_name) > 1
        )
      ) THEN
        v_review := 'normalized_name_collision';
      END IF;
    END IF;

    IF v_review IS NULL THEN
      SELECT coalesce(array_agg(r.match_id ORDER BY r.sort_order) FILTER (WHERE v.sort_order <> r.sort_order), '{}'),
             greatest(v_max_order, max(r.sort_order))
      INTO v_moved, v_sort_base
      FROM jsonb_to_recordset(v_plan) AS r(match_id uuid, sort_order integer)
      LEFT JOIN public.gacha_product_variants v ON v.id = r.match_id;

      -- Move swaps into unused positive positions so immediate unique indexes
      -- never observe overlapping slots.
      UPDATE public.gacha_product_variants v
      SET sort_order = v_sort_base + moving.ordinality
      FROM unnest(v_moved) WITH ORDINALITY AS moving(id, ordinality)
      WHERE v.id = moving.id;

      WITH variant_updates AS (
        SELECT v.id,
               coalesce(v.name, r.name, r.name_ja) AS name,
               CASE WHEN nullif(btrim(v.name_ja), '') IS NOT NULL THEN v.name_ja
                    ELSE nullif(btrim(r.name_ja), '') END AS name_ja,
               coalesce(v.image_url, nullif(btrim(r.image_url), '')) AS image_url,
               r.normalized_name, r.sort_order,
               CASE
                 WHEN nullif(btrim(v.name_ja), '') IS NULL AND nullif(btrim(r.name_ja), '') IS NOT NULL
                   THEN nullif(coalesce(r.raw_payload, '{}') || (metadata.payload - 'title_status' - 'generated_name'), '{}')
                 WHEN nullif(btrim(v.name_ja), '') IS NOT NULL AND nullif(btrim(r.name_ja), '') IS NULL
                   THEN v.raw_payload
                 ELSE nullif(coalesce(r.raw_payload, '{}') || metadata.payload, '{}')
               END AS raw_payload
        FROM jsonb_to_recordset(v_plan) AS r(
          match_id uuid, name text, name_ja text, normalized_name text, image_url text,
          sort_order integer, raw_payload jsonb
        )
        JOIN public.gacha_product_variants v ON v.id = r.match_id
        CROSS JOIN LATERAL (
          SELECT CASE WHEN jsonb_typeof(v.raw_payload) = 'object' THEN v.raw_payload ELSE '{}'::jsonb END AS payload
        ) AS metadata
      )
      UPDATE public.gacha_product_variants v
      SET name = updates.name,
          name_ja = updates.name_ja,
          image_url = updates.image_url,
          normalized_name = updates.normalized_name,
          sort_order = updates.sort_order,
          raw_payload = updates.raw_payload,
          updated_at = clock_timestamp()
      FROM variant_updates AS updates
      WHERE v.id = updates.id
        AND (v.name, v.name_ja, v.image_url, v.normalized_name, v.sort_order, v.raw_payload)
            IS DISTINCT FROM (updates.name, updates.name_ja, updates.image_url,
                              updates.normalized_name, updates.sort_order, updates.raw_payload);
      GET DIAGNOSTICS v_updated = ROW_COUNT;

      INSERT INTO public.gacha_product_variants (
        id, product_id, source_name, source_url, name, name_ja, normalized_name,
        image_url, sort_order, source_variant_key, status, raw_payload
      )
      SELECT new.id, p_product_id, p_source_name, new.source_url,
             coalesce(new.name, new.name_ja), nullif(btrim(new.name_ja), ''), new.normalized_name,
             nullif(btrim(new.image_url), ''), new.sort_order,
             'collector:' || new.id::text, 'active', new.raw_payload
      FROM (
        SELECT gen_random_uuid() AS id, r.*
        FROM jsonb_to_recordset(v_plan) AS r(
          match_id uuid, name text, name_ja text, normalized_name text, image_url text,
          sort_order integer, source_url text, raw_payload jsonb
        )
        WHERE r.match_id IS NULL
      ) AS new;
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
    END IF;
  END IF;

  IF p_extraction IS NOT NULL THEN
    IF v_review IS NOT NULL THEN
      v_raw := coalesce(v_raw, '{}') || jsonb_build_object('collector_lineup_review', v_review);
    END IF;
    INSERT INTO public.gacha_product_variant_extraction_results (
      product_id, source_name, parser_version, method, status, expected_count,
      extracted_count, image_count, error_message, raw_payload, fetched_at
    ) VALUES (
      p_product_id, p_source_name, v_version, p_extraction->>'method',
      CASE WHEN v_review IS NOT NULL THEN 'partial' ELSE v_status END,
      (p_extraction->>'expected_count')::integer,
      coalesce((p_extraction->>'extracted_count')::integer, 0),
      coalesce((p_extraction->>'image_count')::integer, 0),
      p_extraction->>'error_message', v_raw, v_fetched_at
    )
    ON CONFLICT (product_id, source_name, parser_version) DO UPDATE
    SET method = excluded.method,
        status = excluded.status,
        expected_count = excluded.expected_count,
        extracted_count = excluded.extracted_count,
        image_count = excluded.image_count,
        error_message = excluded.error_message,
        raw_payload = excluded.raw_payload,
        fetched_at = excluded.fetched_at,
        updated_at = clock_timestamp();
  END IF;

  IF v_review IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'review_required', 'reason', v_review);
  END IF;
  RETURN jsonb_build_object('status', 'applied', 'inserted', v_inserted, 'updated', v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.save_gacha_collector_variants(uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_gacha_collector_variants(uuid, text, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.save_gacha_collector_variant_translation(
  p_variant_id uuid,
  p_expected_name_ja text,
  p_expected_name_ko text,
  p_name_ko text,
  p_translation jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_variant_id IS NULL OR nullif(btrim(p_expected_name_ja), '') IS NULL
     OR nullif(btrim(p_name_ko), '') IS NULL
     OR jsonb_typeof(p_translation) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid collector variant translation';
  END IF;

  -- Respect the same product-before-variant lock order as the lineup writer.
  PERFORM 1 FROM public.gacha_products p
  JOIN public.gacha_product_variants v ON v.product_id = p.id
  WHERE v.id = p_variant_id
  FOR UPDATE OF p;

  UPDATE public.gacha_product_variants
  SET name_ko = p_name_ko,
      raw_payload = (CASE WHEN jsonb_typeof(raw_payload) = 'object' THEN raw_payload ELSE '{}'::jsonb END)
                    || jsonb_build_object('ko_translation', p_translation),
      updated_at = clock_timestamp()
  WHERE id = p_variant_id AND status = 'active'
    AND name_ja IS NOT DISTINCT FROM p_expected_name_ja
    AND name_ko IS NOT DISTINCT FROM p_expected_name_ko;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.save_gacha_collector_variant_translation(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_gacha_collector_variant_translation(uuid, text, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.gacha_collector_variant_write_version()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$ SELECT 1; $$;

REVOKE ALL ON FUNCTION public.gacha_collector_variant_write_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gacha_collector_variant_write_version() TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
