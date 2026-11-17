-- Run through dev Supabase MCP. Every fixture/write is rolled back.
BEGIN;
DO $$
DECLARE
  pid uuid; old_parts jsonb; parts jsonb; malformed jsonb; sid uuid; merged_id uuid; parent_sid uuid;
  cid uuid; manual_cid uuid; alias_id uuid; failed boolean; n integer; terms text;
BEGIN
  SELECT id,name_parts INTO pid,old_parts FROM public.gacha_products WHERE status='active' ORDER BY id LIMIT 1;
  IF pid IS NULL THEN RAISE EXCEPTION 'Test requires one active product'; END IF;
  INSERT INTO public.gacha_series(name_ko,kind,status,source) VALUES ('분류회귀부모','franchise','active','manual') RETURNING id INTO parent_sid;
  INSERT INTO public.gacha_series(name_ko,kind,status,source,parent_id) VALUES ('분류회귀정본','character_brand','active','manual',parent_sid) RETURNING id INTO sid;
  INSERT INTO public.gacha_series(name_ko,kind,status,source,merged_into_id) VALUES ('분류회귀병합원본','character_brand','archived','manual',sid) RETURNING id INTO merged_id;
  INSERT INTO public.gacha_categories(name_ko,category_type,status,source) VALUES ('분류회귀계열','line','active','manual') RETURNING id INTO cid;
  INSERT INTO public.gacha_categories(name_ko,category_type,status,source) VALUES ('분류회귀수동','subject','active','manual') RETURNING id INTO manual_cid;
  INSERT INTO public.gacha_product_categories(product_id,category_id,relation_type,confidence,source)
    VALUES(pid,manual_cid,'manual',0.75,'manual');
  INSERT INTO public.gacha_product_series(product_id,series_id,relation_type,confidence,source)
    VALUES(pid,sid,'crossover',0.75,'manual');
  parts:=jsonb_build_object('series',jsonb_build_object('ko','분류회귀미확정신규','ja','UnknownNewIP'),
    'tags','[]'::jsonb,'product_type',null,'version','회귀버전',
    'taxonomy',jsonb_build_object('version',2,'dictionary_hash',repeat('a',64),
      'inputs',jsonb_build_object('series',jsonb_build_array(jsonb_build_object('ja',null,'ko','분류회귀정본','relation_type','primary')),
        'lines',jsonb_build_array(jsonb_build_object('ja',null,'ko','분류회귀계열')),'product_type',null,'tags','[]'::jsonb),
      'series',jsonb_build_array(jsonb_build_object('id',sid,'relation_type','primary')),
      'category_ids',jsonb_build_array(cid),'unresolved','[]'::jsonb));
  PERFORM public.save_gacha_product_name_parts_v2(pid,parts,old_parts);
  PERFORM public.save_gacha_product_name_parts_v2(pid,parts,parts);
  IF EXISTS(SELECT 1 FROM public.gacha_series WHERE name_ko='분류회귀미확정신규') THEN RAISE EXCEPTION 'v2 created an unreviewed series'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.gacha_product_series WHERE product_id=pid AND series_id=sid AND source='manual' AND relation_type='crossover' AND confidence=0.75) THEN RAISE EXCEPTION 'Manual series overwritten'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.gacha_product_categories WHERE product_id=pid AND category_id=manual_cid AND source='manual') THEN RAISE EXCEPTION 'Manual category removed'; END IF;
  IF (SELECT count(*) FROM public.gacha_product_categories WHERE product_id=pid AND category_id=cid)<>1 THEN RAISE EXCEPTION 'Non-idempotent mapping'; END IF;
  -- A same-product UPDATE must not attempt two UPSERTs for the same queue key.
  UPDATE public.gacha_product_categories SET note='same product update' WHERE product_id=pid AND category_id=cid;
  IF NOT EXISTS(SELECT 1 FROM public.gacha_product_search_dirty WHERE product_id=pid) THEN RAISE EXCEPTION 'Relation update did not queue'; END IF;
  failed:=false;
  BEGIN
    PERFORM public.save_gacha_product_name_parts_v2(pid,parts,old_parts);
  EXCEPTION WHEN raise_exception THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'Stale write was accepted'; END IF;
  malformed:=jsonb_set(parts,'{taxonomy,category_ids}',jsonb_build_array(gen_random_uuid()));
  failed:=false;
  BEGIN
    PERFORM public.save_gacha_product_name_parts_v2(pid,malformed,parts);
  EXCEPTION WHEN raise_exception THEN failed:=true; END;
  IF NOT failed OR (SELECT name_parts FROM public.gacha_products WHERE id=pid) IS DISTINCT FROM parts THEN RAISE EXCEPTION 'Bad ID did not roll back'; END IF;
  malformed:=jsonb_set(parts,'{taxonomy,inputs,lines}','[{}]'::jsonb);
  failed:=false;
  BEGIN
    PERFORM public.save_gacha_product_name_parts_v2(pid,malformed,parts);
  EXCEPTION WHEN raise_exception THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'Malformed input accepted'; END IF;
  INSERT INTO public.gacha_category_aliases(category_id,alias,alias_type,status,source)
    VALUES(cid,'회귀계열별칭','nickname','approved','manual') RETURNING id INTO alias_id;
  PERFORM public.refresh_gacha_product_search_docs(ARRAY[pid]);
  IF NOT EXISTS(SELECT 1 FROM public.search_gacha_products('회귀계열별칭',p_fuzzy=>false,p_limit=>100) WHERE id=pid) THEN RAISE EXCEPTION 'Category alias search missed product'; END IF;
  IF EXISTS(SELECT 1 FROM public.search_gacha_products('회귀계열별칭 절대없는다른조건',p_fuzzy=>false,p_limit=>100) WHERE id=pid) THEN RAISE EXCEPTION 'Token AND regressed'; END IF;
  UPDATE public.gacha_category_aliases SET status='rejected' WHERE id=alias_id;
  IF NOT EXISTS(SELECT 1 FROM public.gacha_product_search_dirty WHERE product_id=pid) THEN RAISE EXCEPTION 'Alias rejection did not queue'; END IF;
  PERFORM public.refresh_gacha_product_search_docs(ARRAY[pid]);
  IF EXISTS(SELECT 1 FROM public.search_gacha_products('회귀계열별칭',p_fuzzy=>false,p_limit=>100) WHERE id=pid) THEN RAISE EXCEPTION 'Rejected category alias remained indexed'; END IF;
  INSERT INTO public.gacha_series_aliases(series_id,alias,alias_type,status,source)
    VALUES(merged_id,'회귀병합별칭','nickname','approved','manual') RETURNING id INTO alias_id;
  IF NOT EXISTS(SELECT 1 FROM public.gacha_product_search_dirty WHERE product_id=pid) THEN RAISE EXCEPTION 'Merged alias did not queue target product'; END IF;
  PERFORM public.refresh_gacha_product_search_docs(ARRAY[pid]);
  SELECT doc_all INTO terms FROM public.gacha_product_search_docs WHERE product_id=pid;
  IF position('회귀병합별칭' in terms)=0 OR position('분류회귀부모' in terms)=0 THEN RAISE EXCEPTION 'Merged alias or parent absent from index'; END IF;
  DELETE FROM public.gacha_series_aliases WHERE id=alias_id;
  PERFORM public.refresh_gacha_product_search_docs(ARRAY[pid]);
  SELECT doc_all INTO terms FROM public.gacha_product_search_docs WHERE product_id=pid;
  IF position('회귀병합별칭' in terms)>0 THEN RAISE EXCEPTION 'Deleted merged alias remained indexed'; END IF;
  UPDATE public.gacha_series SET name_ko='분류회귀새부모' WHERE id=parent_sid;
  IF NOT EXISTS(SELECT 1 FROM public.gacha_product_search_dirty WHERE product_id=pid) THEN RAISE EXCEPTION 'Parent rename did not queue child product'; END IF;
  PERFORM public.refresh_gacha_product_search_docs(ARRAY[pid]);
  SELECT doc_all INTO terms FROM public.gacha_product_search_docs WHERE product_id=pid;
  IF position('분류회귀새부모' in terms)=0 OR position('분류회귀부모' in terms)>0 THEN RAISE EXCEPTION 'Parent rename index stale'; END IF;
  UPDATE public.gacha_series SET is_hidden=true WHERE id=sid;
  IF position('분류회귀정본' in public.gacha_product_taxonomy_search_terms(pid))=0 THEN RAISE EXCEPTION 'Browse-only hidden flag incorrectly hides search'; END IF;
  UPDATE public.gacha_categories SET status='hidden' WHERE id=cid;
  IF position('분류회귀계열' in public.gacha_product_taxonomy_search_terms(pid))>0 THEN RAISE EXCEPTION 'Hidden category leaked canonical terms'; END IF;
  -- Empty valid classification removes only automatic relations, not manual ones.
  UPDATE public.gacha_categories SET status='active' WHERE id=cid;
  parts:=jsonb_set(jsonb_set(parts,'{taxonomy,series}','[]'::jsonb),'{taxonomy,category_ids}','[]'::jsonb);
  PERFORM public.save_gacha_product_name_parts_v2(pid,parts,(SELECT name_parts FROM public.gacha_products WHERE id=pid));
  IF EXISTS(SELECT 1 FROM public.gacha_product_categories WHERE product_id=pid AND category_id=cid) THEN RAISE EXCEPTION 'Empty classification did not remove auto mapping'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.gacha_product_categories WHERE product_id=pid AND category_id=manual_cid) THEN RAISE EXCEPTION 'Empty classification removed manual mapping'; END IF;
  IF has_function_privilege('anon','public.save_gacha_product_name_parts_v2(uuid,jsonb,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.get_gacha_taxonomy_dictionary()','EXECUTE') THEN RAISE EXCEPTION 'Write/dictionary RPC privilege leak'; END IF;
END $$;
ROLLBACK;
SELECT 'taxonomy v2 rollback regression passed' AS result;
