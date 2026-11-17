-- 택소노미 축 재정의 — prod 적용용 통합본
--
-- ⚠️ **이 파일은 prod 에만 쓴다. dev 에는 적용하지 마라.**
--    dev 는 아래 7건을 순서대로 적용해 지금 상태에 도달했다. prod 에 그걸 그대로
--    재생하면 같은 데이터를 세 번 뒤집는다. 중간에 실패하면 어느 단계인지
--    가려내기도 어렵다. 이 파일은 **최종 상태만** 만든다.
--
--    dev 적용 이력 (재생 금지)
--      20260906_brand_lines_to_series              4건을 series 로
--      20260906_representative_image_candidates    대표 이미지 규칙
--      20260907_revert_panda_pockettomica_to_line  위 4건 중 2건 되돌림
--      20260907_toy_brand_series_targets           아니아 생성·컵 소코코 복구
--      20260907_toy_brand_dictionary_3col          사전 3열화
--      20260907_brand_lines_out_of_line_axis       line 6건 archive
--      20260907_brand_dict_panda_pockettomica      사전에 2건
--      20260907_more_brands_out_of_line_axis       line 5건 archive
--      20260907_brand_dict_add_five                사전에 5건
--
--    prod 에는 아래 3개만 순서대로 넣는다.
--      1) 20260906_representative_image_candidates.sql   (대표 이미지, 별도 파일)
--      2) 이 파일
--      3) 없음 — 나머지는 이 파일에 흡수됐다
--
-- ── 무엇을 하는가 ─────────────────────────────────────────────────────────
--
-- series 축을 "IP + 완구 브랜드"로 넓히고, 브랜드 성격인 것을 line 축에서 뺀다.
-- 같은 대상이 두 축에 나뉘어 보이면 이용자가 어디서 찾아야 할지 알 수 없다.
--
-- line 은 "IP 위에 씌우는 형태"만 남긴다 — 메지루시(이름표) · 카타즌(어깨 위) ·
-- 오네무탄(자는 모습) 등 25건.
--
-- ── 판정 근거에 대한 경고 ─────────────────────────────────────────────────
--
-- 초안은 "상품명에 외부 IP 가 붙는 비율"로 형태와 브랜드를 갈랐다. **그 지표는
-- 폐기됐다.** line 34건 전수로 재보니 100 에서 0 까지 연속 분포라 경계가 없고,
-- 지표가 재는 것은 형태가 아니라 "현재 IP 사전과 문자열 규칙으로 검출되는
-- 비율"이다. 푸티또(34.2%)가 반례다 — 제조사가 스스로 "피규어 브랜드"라 부르면서
-- 컵 가장자리에 거는 형식을 공유한다. 브랜드와 형태는 반대 개념이 아니다.
--
-- 아래 13건은 상품명 패턴과 공식 자료로 개별 판정했다.
-- 계획: docs/plans/20260907-taxonomy-axis-redefinition.md
--
-- ── 적용 전 확인 (prod 에서 반드시 실행) ──────────────────────────────────
--
--   -- ① 대상 series 가 존재하고 병합되지 않았는지
--   select name_ko, status, kind, merged_into_id is not null as merged
--   from public.gacha_series
--   where name_ko in ('닛코리노','컵의 후치코','컵 소코코','판다의 구멍','포켓토미카',
--                     '냥코마트','냥코 키친DX','냥코 빵집','1/64PLUS',
--                     '가챠 분의 일 시리즈','플라레일','토미카','아니아');
--   --> merged 가 true 인 게 있으면 중단. 이 스크립트는 병합을 따라가지 않는다.
--
--   -- ② 적용 전 링크 수를 기록해 둔다 (사후 비교용)
--   select s.name_ko, count(ps.product_id)
--   from public.gacha_series s
--   left join public.gacha_product_series ps on ps.series_id = s.id
--   where s.name_ko in (위와 동일) group by s.name_ko;
--
-- ── 롤백 ──────────────────────────────────────────────────────────────────
--
--   update public.gacha_categories set status='active'
--   where category_type='line' and name_ko in
--     ('캡슐 플라레일','포켓토미카','캡슐토미카DX','캡슐 아니아','컵 소코코',
--      '판다의 구멍','냥코마트','냥코 키친DX','냥코 빵집','1/64PLUS','가챠 분의 일 시리즈');
--   update public.gacha_series set status='archived', kind='toy_line'
--   where name_ko in ('판다의 구멍','포켓토미카','냥코마트','냥코 키친DX','냥코 빵집',
--                     '1/64PLUS','가챠 분의 일 시리즈','컵 소코코');
--   delete from public.gacha_series where name_ko='아니아' and source='manual';
--   -- 그리고 refresh_gacha_product_series 를 20260822 정의로 복원 후 두 refresh 재실행

-- ══ 1) gacha_product_series.source 에 known_product_line_term 허용 ═══════
--    카테고리 쪽에는 있는 값인데 시리즈 쪽 CHECK 에는 없다. 그대로 쓰면 위반이다.

alter table public.gacha_product_series
  drop constraint if exists gacha_product_series_source_check;

alter table public.gacha_product_series
  add constraint gacha_product_series_source_check
  check (source = any (array['name_parts', 'manual', 'collector_llm', 'user_log', 'known_product_line_term']));

-- ══ 2) 타깃 series 확보 ═══════════════════════════════════════════════════
--    3) 의 브랜드 사전이 status='active' 를 조인하고, 타깃이 하나라도 없으면
--    함수가 예외를 던진다. 그래서 series 확보가 먼저다.

-- 아니아 — 타카라토미 동물 피규어 브랜드. prod 에 없을 수 있어 upsert 한다.
insert into public.gacha_series (name_ko, name_ja, kind, status, source, note)
values ('아니아', 'アニア', 'franchise', 'active', 'manual',
        'Takara Tomy animal figure brand. Parent of the 캡슐 아니아 product line.')
on conflict (name_ko_norm) do update
set status = 'active',
    kind = excluded.kind,
    name_ja = coalesce(public.gacha_series.name_ja, excluded.name_ja),
    updated_at = now();

-- 자체 캐릭터 브랜드
update public.gacha_series
set status = 'active', kind = 'character_brand', is_hidden = false, updated_at = now()
where name_ko in ('닛코리노', '컵의 후치코', '컵 소코코', '판다의 구멍',
                  '냥코마트', '냥코 키친DX', '냥코 빵집')
  and status <> 'active';

-- 완구 브랜드·상품군
update public.gacha_series
set status = 'active', kind = 'franchise', is_hidden = false, updated_at = now()
where name_ko in ('포켓토미카', '1/64PLUS', '가챠 분의 일 시리즈')
  and status <> 'active';

-- 플라레일·토미카는 prod 에도 이미 active 로 있을 것이다. kind 는 건드리지 않는다
-- (토미카가 'other' 인데 노출에 영향이 없고, 기준 없이 하나만 바꾸면 임의 분류가 된다).
update public.gacha_series
set status = 'active', is_hidden = false, updated_at = now()
where name_ko in ('플라레일', '토미카')
  and status <> 'active';

-- ══ 3) line 카테고리 11건 archive ════════════════════════════════════════
--    refresh_gacha_product_categories() 의 line 삽입이 c.status='active' 를
--    조인하므로 archive 만으로 링크 생성 경로가 끊긴다. 같은 함수가 line
--    카테고리를 upsert 하지 않는 것도 확인했다 — refresh 후에도 archive 가 유지된다.
--
--    ⚠️ 사전(line_patterns)에는 패턴이 남는다. 카테고리가 archived 라 무해하지만,
--       누군가 되살리면 링크가 재생성된다. 사전에서 실제로 지우는 것은 후속 과제다.

update public.gacha_categories
set status = 'archived', updated_at = now()
where category_type = 'line'
  and name_ko in ('캡슐 플라레일', '포켓토미카', '캡슐토미카DX', '캡슐 아니아',
                  '컵 소코코', '판다의 구멍',
                  '냥코마트', '냥코 키친DX', '냥코 빵집',
                  '1/64PLUS', '가챠 분의 일 시리즈');

-- ══ 4) 브랜드 사전 ═══════════════════════════════════════════════════════
--    함수 본문은 dev 최종본과 동일하다. 아래 파일에서 그대로 가져온다.
--
--        supabase/migrations/20260907_brands_out_of_line_axis.sql
--
--    ⚠️ 이 파일에 본문을 복사해 두지 않았다. 두 곳에 두면 반드시 갈라진다.
--       prod 적용 시 위 파일의 `create or replace function
--       public.refresh_gacha_product_series ... $function$;` 블록과 이어지는
--       comment/grant 를 여기에 붙여 실행한다.
--
--    사전이 담는 것 (14항목 / 타깃 13개)
--      자체 캐릭터 브랜드 — 계열명 = 타깃
--        にっこりーノ · コップのフチ子|のフチ子 · コップのソコ子 · パンダの穴
--        にゃんこマート · にゃんこキッチンDX · にゃんこパン屋さん
--        1/64 ?PLUS · ガチャぶんのいち
--      제품 계열 → 상위 브랜드
--        カプセルプラレール → 플라레일
--        ポケットトミカ     → 토미카,  포켓토미카   ← 타깃 둘
--        カプセルトミカDX   → 토미카
--        カプセルアニア     → 아니아
--
--    사전 설계에서 지켜야 할 세 가지 (전부 codex 검토로 잡힌 것)
--      ① pattern 과 target 을 분리한다. 타깃 이름으로 한국어를 매칭하면
--         '토미카' 가 든 상품 51건이 걸린다 — 의도한 27건의 두 배다
--      ② 충돌 시 relation_type·source 를 덮지 않는다. name_parts 가 만든
--         primary/collaboration 은 IP 관계이고 정보량이 더 많다.
--         덮으면 상품 수는 그대로라 개수 검증으로 안 잡힌다
--      ③ 타깃 미해소를 raise exception 으로 처리한다. 조용히 누락되면
--         카테고리를 archive 한 뒤 분류 공백이 된다

-- ══ 5) 재생성 + MV 갱신 ══════════════════════════════════════════════════

select public.refresh_gacha_product_categories();
select public.refresh_gacha_product_series();

refresh materialized view public.gacha_category_browse;
refresh materialized view public.gacha_series_browse;

notify pgrst, 'reload schema';

-- ══ 6) 적용 후 검증 (dev 기준값) ═════════════════════════════════════════
--
--   select s.name_ko, s.kind, count(ps.product_id) as links
--   from public.gacha_series s
--   left join public.gacha_product_series ps on ps.series_id = s.id
--   where s.status='active' and s.name_ko in
--     ('닛코리노','플라레일','판다의 구멍','컵의 후치코','토미카','1/64PLUS',
--      '포켓토미카','아니아','컵 소코코','냥코마트','냥코 키친DX',
--      '가챠 분의 일 시리즈','냥코 빵집')
--   group by s.id, s.name_ko, s.kind order by links desc;
--
--   dev 값 — prod 는 상품 모수가 달라 수치가 다를 수 있다. 비율과 순서를 본다.
--     닛코리노 212 · 플라레일 113 · 판다의 구멍 78 · 컵의 후치코 58 · 토미카 40
--     1/64PLUS 25 · 포켓토미카 21 · 아니아 8 · 컵 소코코 7
--     냥코마트 6 · 냥코 키친DX 6 · 가챠분의일 5 · 냥코 빵집 4
--
--   -- line 축에 11건이 남아 있지 않은지 (0 이어야 한다)
--   select count(*) from browse_gacha_categories('line')
--   where name_ko in ('캡슐 플라레일','포켓토미카','캡슐토미카DX','캡슐 아니아',
--                     '컵 소코코','판다의 구멍','냥코마트','냥코 키친DX',
--                     '냥코 빵집','1/64PLUS','가챠 분의 일 시리즈');
--
--   -- 멱등성: refresh 2회 연속 실행 후 링크 수·중복이 불변인지
--   select public.refresh_gacha_product_series();
--   select count(*) from (select product_id, series_id from public.gacha_product_series
--                         group by 1,2 having count(*)>1) d;   --> 0
