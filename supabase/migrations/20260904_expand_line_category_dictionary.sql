-- 가챠 종류(제품 라인)를 시리즈가 아니라 카테고리로 정리한다.
--
-- 배경
--   gacha_series.kind='toy_line'은 오네무탄/메지루시처럼 "가챠 종류"를 가리키는 이름이다.
--   개념상 IP(시리즈)가 아니라 속성(카테고리 category_type='line')이어야 한다.
--   2026-08-26 마이그레이션은 browse_gacha_series에 `kind <> 'toy_line'` 필터를 넣어
--   화면에서 가리기만 했고, 데이터는 양쪽에 그대로 남아 있었다.
--
-- 실측 (dev, 2026-09-04)
--   active toy_line 시리즈 216개 중 상품 4건 이상이 31개.
--   이들의 상품 링크 837건 중 line 카테고리로 커버되던 것은 98건(12%)뿐이었다.
--   원인은 분류 실패가 아니라 refresh_gacha_product_categories() 안의
--   line_patterns 사전에 등재되지 않아서였다. 사전이 곧 line 카테고리 목록이다.
--
-- 이 마이그레이션이 하는 일
--   1) 사전에 없던 제품 라인 24개를 gacha_categories(category_type='line')에 추가
--   2) refresh_gacha_product_categories()의 line_patterns 사전을 같은 24개로 확장
--   함수가 relation_type='line', source='known_product_line_term', confidence=1로
--   링크를 만들어 주므로 수동 링크 insert는 하지 않는다.
--
--   ⚠️ gacha_product_categories.source 기본값은 'name_parts'인데, 이 함수 첫 줄이
--      source in ('name_parts','known_product_line_term') 행을 지운다. 수동으로 링크를
--      넣어야 할 일이 생기면 반드시 source='manual'을 써야 살아남는다.
--
-- 사전에 넣지 않은 것 (실측 근거)
--   데포라바(9)        기존 '데포러버' 카테고리가 이미 100% 커버. 표기만 다른 중복
--   마치보우케(9)      기존 '마치보케'가 이미 100% 커버. 동일
--   판다의 구멍 주주주(7) 신규 'パンダの穴' 패턴이 흡수
--   플라레일(6)        'プラレール'가 'カプセルプラレール' 107건을 함께 삼킨다.
--                      게다가 타카라토미 브랜드지 가챠 종류가 아니다
--   리카짱(9)          リカちゃん은 인형 IP다. toy_line 오분류이며 시리즈로 남겨야 한다
--
-- 하지 않는 일 (후속)
--   - toy_line 시리즈 archive: 커버리지 확인 후 별도 마이그레이션
--   - browse_gacha_series의 `kind <> 'toy_line'` 필터 제거:
--     롱테일 185개(상품 1~3건)가 남아 있어, 지금 제거하면 상품이 4건을 넘는 순간
--     시리즈 목록에 재노출된다. 롱테일 처리 후에만 제거할 것
--   - line 축 UI 노출: 노션 기획서 → Penpot → 프론트 순서를 따른다

-- 1) 신규 제품 라인 카테고리
--    name_ko_norm은 생성 컬럼(gacha_normalize_search_text)이며 전역 유니크다.
--    category_type이 달라도 같은 이름이면 충돌하므로 DO NOTHING으로 방어한다.
insert into public.gacha_categories (name_ko, name_ja, category_type, display_order, status, source, note)
values
  ('닛코리노',                 'にっこりーノ',                    'line', 900, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('캡슐 플라레일',            'カプセルプラレール',              'line', 901, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('판다의 구멍',              'パンダの穴',                      'line', 902, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('컵의 후치코',              'コップのフチ子',                  'line', 903, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('푸티또',                   'PUTITTO',                         'line', 904, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('포켓토미카',               'ポケットトミカ',                  'line', 905, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('ntc.Puff',                 'ntc.Puff',                        'line', 906, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('아기클럽',                 '赤ちゃん倶楽部',                  'line', 907, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('캡구루미',                 'かぷぐるみ',                      'line', 908, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('1/64PLUS',                 '1/64PLUS',                        'line', 909, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('캡슐 아니아',              'カプセルアニア',                  'line', 910, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('컵 소코코',                'コップのソコ子',                  'line', 911, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('워터돔팩토리',             'WaterDomeFactory',                'line', 912, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('딱 열리는 캐릭터 손목시계','ぱかっとひらく！キャラうでどけい','line', 913, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('네코의 펜꽂이',            'ネコのペンおき',                  'line', 914, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('욕실 수족관',              'お風呂で水族館',                  'line', 915, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('캡슐토미카DX',             'カプセルトミカDX',                'line', 916, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('가챠 분의 일 시리즈',      'ガチャぶんのいちシリーズ',        'line', 917, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('치루코토',                 'ちるこっと',                      'line', 918, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('케츠혼 반지',              'ケツ婚指輪',                      'line', 919, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('냥코마트',                 'にゃんこマート',                  'line', 920, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('냥코 빵집',                'にゃんこパン屋さん',              'line', 921, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('냥코 키친DX',              'にゃんこキッチンDX',              'line', 922, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04'),
  ('귀여운 마스코트 라이트',   'かわいい！マスコットライト',      'line', 923, 'active', 'known_product_line_term', 'toy_line series cleanup 2026-09-04')
on conflict (name_ko_norm) do nothing;

-- 2) line_patterns 사전 확장
--    기존 17개는 그대로 두고 24개를 덧붙인다. 함수 나머지 부분은 20260820022518과 동일하다.

create or replace function public.refresh_gacha_product_categories(p_product_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_vocab_categories_upserted integer := 0;
  v_line_categories_upserted integer := 0;
  v_category_aliases_upserted integer := 0;
  v_product_type_aliases_upserted integer := 0;
  v_product_type_categories_upserted integer := 0;
  v_deleted_mappings integer := 0;
  v_tag_mappings_upserted integer := 0;
  v_line_mappings_upserted integer := 0;
  v_product_type_mappings_upserted integer := 0;
begin
  delete from public.gacha_product_categories pc
  where pc.source in ('name_parts', 'known_product_line_term')
    and (p_product_ids is null or pc.product_id = any(p_product_ids));
  get diagnostics v_deleted_mappings = row_count;

  with product_tags as (
    select distinct
      gp.id as product_id,
      nullif(btrim(tag.value), '') as name_ko
    from public.gacha_products gp
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(gp.name_parts -> 'tags') = 'array' then gp.name_parts -> 'tags' else '[]'::jsonb end
    ) as tag(value)
    where gp.status = 'active'
      and jsonb_typeof(gp.name_parts -> 'tags') = 'array'
      and (p_product_ids is null or gp.id = any(p_product_ids))
  )
  insert into public.gacha_product_categories (product_id, category_id, relation_type, confidence, source, note)
  select
    pt.product_id,
    c.id,
    'tag',
    0.9,
    'name_parts',
    'Backfilled from curated gacha_products.name_parts.tags'
  from product_tags pt
  join public.gacha_categories c
    on c.name_ko_norm = public.gacha_normalize_search_text(pt.name_ko)
   and c.category_type in ('genre', 'subject', 'origin')
   and c.status = 'active'
  where pt.name_ko is not null
  on conflict (product_id, category_id) do update
  set relation_type = excluded.relation_type,
      confidence = greatest(public.gacha_product_categories.confidence, excluded.confidence),
      source = excluded.source,
      note = excluded.note,
      updated_at = now()
  where public.gacha_product_categories.source = 'name_parts';
  get diagnostics v_tag_mappings_upserted = row_count;

  with line_patterns(category_name_ko, source_pattern) as (
    values
      ('코로코레', 'ころコレ'),
      ('닛코리노', 'にっこりーノ'),
      ('캡슐 플라레일', 'カプセルプラレール'),
      ('판다의 구멍', 'パンダの穴'),
      ('컵의 후치코', 'コップのフチ子|のフチ子'),
      ('푸티또', 'PUTITTO'),
      ('포켓토미카', 'ポケットトミカ'),
      ('ntc.Puff', 'ntc[.]Puff'),
      ('아기클럽', '赤ちゃん(倶|俱)楽部'),
      ('캡구루미', 'かぷぐるみ'),
      ('1/64PLUS', '1/64 ?PLUS'),
      ('캡슐 아니아', 'カプセルアニア'),
      ('컵 소코코', 'コップのソコ子'),
      ('워터돔팩토리', 'WaterDomeFactory'),
      ('딱 열리는 캐릭터 손목시계', 'ぱかっとひらく！?キャラうでどけい'),
      ('네코의 펜꽂이', 'ネコのペンおき'),
      ('욕실 수족관', 'お風呂で水族館'),
      ('캡슐토미카DX', 'カプセルトミカDX'),
      ('가챠 분의 일 시리즈', 'ガチャぶんのいち'),
      ('치루코토', 'ちるこっと'),
      ('케츠혼 반지', 'ケツ婚指輪'),
      ('냥코마트', 'にゃんこマート'),
      ('냥코 빵집', 'にゃんこパン屋さん'),
      ('냥코 키친DX', 'にゃんこキッチンDX'),
      ('귀여운 마스코트 라이트', 'かわいい！?マスコットライト'),
      ('메지루시', 'めじるし'),
      ('오네무탄', 'おねむたん|オネムタン'),
      ('마치보케', 'まちぼうけ|マチボウケ|待ちぼうけ'),
      ('카타즌', '肩ズン'),
      ('데포러버', 'でふぉラバ|デフォラバ'),
      ('피타 데포메', 'ぴた！?でふぉめ|ぴたでふぉめ|ピタ！?デフォメ|ピタデフォメ'),
      ('스와라세타이', 'すわらせ隊'),
      ('네무라세타이', 'ねむらせ隊'),
      ('나라분데스', 'ならぶんです'),
      ('츠만데 츠나게떼', 'つまんでつなげて'),
      ('반쵸코', 'キャラばんちょうこう|ばんちょうこう'),
      ('쵸코노코', 'ちょこのっこ|チョコノッコ'),
      ('허그콧', 'ハグコット|HUGCOT|Hugcot'),
      ('링코레', 'Ringcolle!?|リングコレクション'),
      ('생물대도감', 'いきもの大図鑑'),
      ('오쿠루미', 'おくるみますこっと|おくるみマスコット|おくるみ')
  ),
  product_line_matches as (
    select distinct gp.id as product_id, lp.category_name_ko
    from public.gacha_products gp
    join line_patterns lp
      on coalesce(gp.name_ja, gp.name, '') ~ lp.source_pattern
      or coalesce(gp.name, '') ~ lp.source_pattern
      or coalesce(gp.name_ko, '') ~ lp.category_name_ko
    where gp.status = 'active'
      and (p_product_ids is null or gp.id = any(p_product_ids))
  )
  insert into public.gacha_product_categories (product_id, category_id, relation_type, confidence, source, note)
  select
    plm.product_id,
    c.id,
    'line',
    1,
    'known_product_line_term',
    'Mapped from domestic gacha product line term in product source name'
  from product_line_matches plm
  join public.gacha_categories c
    on c.name_ko_norm = public.gacha_normalize_search_text(plm.category_name_ko)
   and c.category_type = 'line'
   and c.status = 'active'
  on conflict (product_id, category_id) do update
  set relation_type = excluded.relation_type,
      confidence = greatest(public.gacha_product_categories.confidence, excluded.confidence),
      source = excluded.source,
      note = excluded.note,
      updated_at = now()
  where public.gacha_product_categories.source = 'known_product_line_term';
  get diagnostics v_line_mappings_upserted = row_count;

  with product_types as (
    select distinct
      gp.id as product_id,
      nullif(btrim(gp.name_parts -> 'product_type' ->> 'ko'), '') as name_ko,
      nullif(btrim(gp.name_parts -> 'product_type' ->> 'ja'), '') as name_ja,
      public.gacha_normalize_search_text(nullif(btrim(gp.name_parts -> 'product_type' ->> 'ko'), '')) as name_ko_norm,
      public.gacha_normalize_search_text(nullif(btrim(gp.name_parts -> 'product_type' ->> 'ja'), '')) as name_ja_norm
    from public.gacha_products gp
    where gp.status = 'active'
      and (
        gp.name_parts -> 'product_type' ->> 'ko' is not null
        or gp.name_parts -> 'product_type' ->> 'ja' is not null
      )
      and (p_product_ids is null or gp.id = any(p_product_ids))
  ),
  product_type_matches as (
    select distinct pt.product_id, a.category_id
    from product_types pt
    join public.gacha_category_aliases a
      on a.status = 'approved'
     and (
       a.alias_norm in (pt.name_ko_norm, pt.name_ja_norm)
       or (
         char_length(a.alias_norm) >= 2
         and (
           position(a.alias_norm in coalesce(pt.name_ko_norm, '')) > 0
           or position(a.alias_norm in coalesce(pt.name_ja_norm, '')) > 0
         )
       )
     )
    join public.gacha_categories c
      on c.id = a.category_id
     and c.category_type = 'product_type'
     and c.status = 'active'
  )
  insert into public.gacha_product_categories (product_id, category_id, relation_type, confidence, source, note)
  select
    ptm.product_id,
    ptm.category_id,
    'product_type',
    0.95,
    'name_parts',
    'Mapped from curated product type alias in gacha_products.name_parts.product_type'
  from product_type_matches ptm
  on conflict (product_id, category_id) do update
  set relation_type = excluded.relation_type,
      confidence = greatest(public.gacha_product_categories.confidence, excluded.confidence),
      source = excluded.source,
      note = excluded.note,
      updated_at = now()
  where public.gacha_product_categories.source = 'name_parts';
  get diagnostics v_product_type_mappings_upserted = row_count;

  return jsonb_build_object(
    'vocab_categories_upserted', v_vocab_categories_upserted,
    'line_categories_upserted', v_line_categories_upserted,
    'category_aliases_upserted', v_category_aliases_upserted,
    'product_type_aliases_upserted', v_product_type_aliases_upserted,
    'product_type_categories_upserted', v_product_type_categories_upserted,
    'deleted_mappings', v_deleted_mappings,
    'tag_mappings_upserted', v_tag_mappings_upserted,
    'line_mappings_upserted', v_line_mappings_upserted,
    'product_type_mappings_upserted', v_product_type_mappings_upserted
  );
end;
$function$;

select public.refresh_gacha_product_categories();

notify pgrst, 'reload schema';
