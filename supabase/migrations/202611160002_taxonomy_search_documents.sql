-- Search exact terms come from canonical memberships, never a global OR expansion.
BEGIN;
CREATE OR REPLACE FUNCTION public.resolve_gacha_series_target(p_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH RECURSIVE chain AS (
    SELECT s.id,s.merged_into_id,s.status,ARRAY[s.id] path FROM public.gacha_series s WHERE s.id=p_id
    UNION ALL
    SELECT s.id,s.merged_into_id,s.status,c.path||s.id FROM chain c JOIN public.gacha_series s ON s.id=c.merged_into_id
    WHERE NOT s.id=ANY(c.path) AND cardinality(c.path)<16
  ) SELECT id FROM chain WHERE merged_into_id IS NULL AND status='active' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_gacha_series_target(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_gacha_series_target(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.gacha_product_taxonomy_search_terms(p_product_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH RECURSIVE series_tree AS (
    SELECT s.id,s.parent_id,ARRAY[s.id] AS path FROM public.gacha_product_series ps
    JOIN public.gacha_series s ON s.id=ps.series_id
    WHERE ps.product_id=p_product_id AND s.status='active' AND s.merged_into_id IS NULL AND s.kind<>'toy_line'
    UNION ALL
    SELECT s.id,s.parent_id,t.path||s.id FROM series_tree t JOIN public.gacha_series s ON s.id=t.parent_id
    WHERE s.status='active' AND s.merged_into_id IS NULL AND s.kind<>'toy_line'
      AND NOT s.id=ANY(t.path) AND cardinality(t.path)<16
  ), merged_names AS (
    SELECT DISTINCT id FROM series_tree
    UNION SELECT s.id FROM public.gacha_series s JOIN merged_names m ON s.merged_into_id=m.id
  ), cats AS (
    SELECT c.* FROM public.gacha_product_categories pc JOIN public.gacha_categories c ON c.id=pc.category_id
    WHERE pc.product_id=p_product_id AND c.status='active' AND c.category_type IN ('line','product_type','subject','genre')
  ), terms AS (
    SELECT unnest(ARRAY[c.name_ko,c.name_ja,c.name_en]) AS term FROM cats c
    UNION SELECT a.alias FROM cats c JOIN public.gacha_category_aliases a ON a.category_id=c.id WHERE a.status='approved'
    UNION SELECT unnest(ARRAY[s.name_ko,s.name_ja,s.name_en]) FROM merged_names t JOIN public.gacha_series s ON s.id=t.id
    UNION SELECT a.alias FROM merged_names t JOIN public.gacha_series_aliases a ON a.series_id=t.id WHERE a.status='approved'
  ) SELECT coalesce(string_agg(DISTINCT term,' ' ORDER BY term),'') FROM terms WHERE nullif(btrim(term),'') IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.gacha_product_taxonomy_search_terms(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gacha_product_taxonomy_search_terms(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_gacha_product_search_docs(p_product_ids uuid[] DEFAULT NULL::uuid[], p_batch_limit integer DEFAULT 5000)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ids   uuid[];
  v_count integer;
BEGIN
  IF p_product_ids IS NOT NULL THEN
    v_ids := p_product_ids;
  ELSE
    SELECT coalesce(array_agg(product_id), '{}'::uuid[])
      INTO v_ids
      FROM (
        SELECT product_id FROM public.gacha_product_search_dirty
         ORDER BY queued_at LIMIT greatest(p_batch_limit, 0)
         FOR UPDATE SKIP LOCKED
      ) q;
  END IF;

  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM public.gacha_product_search_dirty WHERE product_id = ANY(v_ids);

  DELETE FROM public.gacha_product_search_docs d
   WHERE d.product_id = ANY (v_ids)
     AND NOT EXISTS (SELECT 1 FROM public.gacha_products p WHERE p.id = d.product_id);

  INSERT INTO public.gacha_product_search_docs (
    product_id, doc_primary, doc_series, doc_variant, doc_code, doc_all,
    doc_fuzzy, has_variant, updated_at
  )
  SELECT
    gp.id, src.doc_primary, src.doc_series, src.doc_variant, src.doc_code,
    src.doc_primary || src.doc_series || src.doc_variant || src.doc_code,
    src.doc_fuzzy, src.has_variant, now()
  FROM public.gacha_products gp
  LEFT JOIN LATERAL (
    SELECT
      public.gacha_normalize_search_text(
        string_agg(concat_ws(' ', gv.name, gv.name_ja, gv.name_ko, gv.name_en), ' ')
      ) AS doc_variant,
      public.gacha_normalize_search_text_ws(
        string_agg(concat_ws(' ', gv.name, gv.name_ja, gv.name_ko, gv.name_en), ' ')
      ) AS doc_variant_ws,
      count(*) > 0 AS has_variant
    FROM public.gacha_product_variants gv
    WHERE gv.product_id = gp.id AND gv.status = 'active'
  ) v ON true
  CROSS JOIN LATERAL (
    SELECT
      public.gacha_normalize_search_text(
        concat_ws(' ', gp.name, gp.name_ja, gp.name_ko, gp.name_en)
      ) AS doc_primary,
      public.gacha_normalize_search_text(
        concat_ws(' ',
          public.gacha_product_taxonomy_search_terms(gp.id),
          gp.name_parts -> 'series' ->> 'ja',
          gp.name_parts -> 'series' ->> 'ko',
          gp.name_parts -> 'product_type' ->> 'ja',
          gp.name_parts -> 'product_type' ->> 'ko',
          gp.name_parts ->> 'version',
          (SELECT string_agg(tag, ' ')
             FROM jsonb_array_elements_text(
                    CASE WHEN jsonb_typeof(gp.name_parts -> 'tags') = 'array'
                         THEN gp.name_parts -> 'tags' ELSE '[]'::jsonb END) AS tag)
        )
      ) AS doc_series,
      coalesce(v.doc_variant, '') AS doc_variant,
      public.gacha_normalize_search_text(
        concat_ws(' ', gp.jan_code, gp.product_code)
      ) AS doc_code,
      public.gacha_normalize_search_text_ws(
        concat_ws(' ',
          gp.name, gp.name_ja, gp.name_ko, gp.name_en,
          gp.name_parts -> 'series' ->> 'ja',
          gp.name_parts -> 'series' ->> 'ko',
          gp.name_parts -> 'product_type' ->> 'ja',
          gp.name_parts -> 'product_type' ->> 'ko',
          (SELECT string_agg(tag, ' ')
             FROM jsonb_array_elements_text(
                    CASE WHEN jsonb_typeof(gp.name_parts -> 'tags') = 'array'
                         THEN gp.name_parts -> 'tags' ELSE '[]'::jsonb END) AS tag),
          v.doc_variant_ws
        )
      ) AS doc_fuzzy,
      coalesce(v.has_variant, false) AS has_variant
  ) src
  WHERE gp.id = ANY (v_ids)
  ON CONFLICT (product_id) DO UPDATE
    SET doc_primary = excluded.doc_primary,
        doc_series  = excluded.doc_series,
        doc_variant = excluded.doc_variant,
        doc_code    = excluded.doc_code,
        doc_all     = excluded.doc_all,
        doc_fuzzy   = excluded.doc_fuzzy,
        has_variant = excluded.has_variant,
        updated_at  = excluded.updated_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;



  RETURN v_count;
END;
$function$;

-- Relation changes enqueue the OLD and NEW products. UPSERT serializes with a refresh
-- that has claimed/deleted a queue row, leaving subsequent changes queued after commit.
CREATE OR REPLACE FUNCTION public.queue_gacha_taxonomy_relation_search()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ids uuid[]:='{}';
BEGIN
  IF TG_OP<>'INSERT' THEN ids:=array_append(ids,OLD.product_id); END IF;
  IF TG_OP<>'DELETE' THEN ids:=array_append(ids,NEW.product_id); END IF;
  INSERT INTO public.gacha_product_search_dirty(product_id,queued_at)
  SELECT DISTINCT u.product_id,now() FROM unnest(ids) u(product_id)
  WHERE EXISTS(SELECT 1 FROM public.gacha_products p WHERE p.id=u.product_id)
  ON CONFLICT(product_id) DO UPDATE SET queued_at=excluded.queued_at;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_gacha_taxonomy_relation_search() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER taxonomy_category_relation_search AFTER INSERT OR UPDATE OR DELETE ON public.gacha_product_categories
FOR EACH ROW EXECUTE FUNCTION public.queue_gacha_taxonomy_relation_search();
CREATE TRIGGER taxonomy_series_relation_search AFTER INSERT OR UPDATE OR DELETE ON public.gacha_product_series
FOR EACH ROW EXECUTE FUNCTION public.queue_gacha_taxonomy_relation_search();

CREATE OR REPLACE FUNCTION public.queue_gacha_taxonomy_dictionary_search()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ids uuid[]:='{}'; old_row jsonb; new_row jsonb; key_name text;
BEGIN
  IF TG_TABLE_NAME IN ('gacha_series','gacha_categories') THEN key_name:='id';
  ELSIF TG_TABLE_NAME='gacha_series_aliases' THEN key_name:='series_id';
  ELSE key_name:='category_id'; END IF;
  IF TG_OP<>'INSERT' THEN old_row:=to_jsonb(OLD); ids:=array_append(ids,(old_row->>key_name)::uuid); END IF;
  IF TG_OP<>'DELETE' THEN new_row:=to_jsonb(NEW); ids:=array_append(ids,(new_row->>key_name)::uuid); END IF;
  -- Ignore updated_at/notes/confidence-only churn from a no-op legacy refresh.
  IF TG_OP='UPDATE' AND (old_row-'updated_at'-'note'-'kind_confidence'-'kind_source')
      IS NOT DISTINCT FROM (new_row-'updated_at'-'note'-'kind_confidence'-'kind_source') THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME IN ('gacha_series','gacha_series_aliases') THEN
    -- Include old/new merge targets as well as the original IDs. On DELETE the
    -- old row is no longer resolvable, so its former target must be retained.
    IF TG_TABLE_NAME='gacha_series' THEN
      ids:=array_append(ids,(old_row->>'merged_into_id')::uuid);
      ids:=array_append(ids,(new_row->>'merged_into_id')::uuid);
    END IF;
    SELECT array_agg(DISTINCT id) INTO ids FROM (
      SELECT unnest(ids) id UNION SELECT public.resolve_gacha_series_target(x) FROM unnest(ids) x
    ) expanded WHERE id IS NOT NULL;
    WITH RECURSIVE affected AS (
      SELECT unnest(ids) id
      UNION SELECT s.id FROM public.gacha_series s JOIN affected a ON s.parent_id=a.id
    ) INSERT INTO public.gacha_product_search_dirty(product_id,queued_at)
      SELECT DISTINCT ps.product_id,now() FROM public.gacha_product_series ps JOIN affected a ON a.id=ps.series_id
      ON CONFLICT(product_id) DO UPDATE SET queued_at=excluded.queued_at;
  ELSE
    INSERT INTO public.gacha_product_search_dirty(product_id,queued_at)
    SELECT DISTINCT pc.product_id,now() FROM public.gacha_product_categories pc WHERE pc.category_id=ANY(ids)
    ON CONFLICT(product_id) DO UPDATE SET queued_at=excluded.queued_at;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_gacha_taxonomy_dictionary_search() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER taxonomy_category_dictionary_search AFTER INSERT OR UPDATE OR DELETE ON public.gacha_categories
FOR EACH ROW EXECUTE FUNCTION public.queue_gacha_taxonomy_dictionary_search();
CREATE TRIGGER taxonomy_category_alias_search AFTER INSERT OR UPDATE OR DELETE ON public.gacha_category_aliases
FOR EACH ROW EXECUTE FUNCTION public.queue_gacha_taxonomy_dictionary_search();
CREATE TRIGGER taxonomy_series_dictionary_search AFTER INSERT OR UPDATE OR DELETE ON public.gacha_series
FOR EACH ROW EXECUTE FUNCTION public.queue_gacha_taxonomy_dictionary_search();
CREATE TRIGGER taxonomy_series_alias_search AFTER INSERT OR UPDATE OR DELETE ON public.gacha_series_aliases
FOR EACH ROW EXECUTE FUNCTION public.queue_gacha_taxonomy_dictionary_search();

-- Queue, rather than synchronously reindexing the entire catalog inside the migration.
INSERT INTO public.gacha_product_search_dirty(product_id,queued_at)
SELECT id,now() FROM public.gacha_products WHERE status='active'
ON CONFLICT(product_id) DO UPDATE SET queued_at=excluded.queued_at;
NOTIFY pgrst, 'reload schema';
COMMIT;
