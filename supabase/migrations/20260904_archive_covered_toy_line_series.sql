-- toy_line 시리즈 정리 후속: 카테고리로 완전히 커버된 것 archive + IP 오분류 kind 교정
--
-- 20260904_expand_line_category_dictionary 로 line 카테고리가 17 -> 41개가 되면서
-- toy_line 시리즈 대부분이 카테고리로 커버됐다. 커버가 끝난 시리즈는 이제 잉여다.
--
-- 안전 조건: 시리즈에 걸린 상품이 "전부" line 카테고리를 갖고 있을 때만 archive 한다.
-- 하나라도 미커버 상품이 있으면 archive 시 그 상품이 완전 무분류가 되므로 남긴다.
--
-- refresh_gacha_product_series() 의 on conflict 절은 status 를 건드리지 않으므로
-- archive 는 collector 배치 후에도 유지된다. gacha_product_series 링크는 계속
-- 재생성되지만 browse_gacha_series 가 status='active' 로 거르므로 노출되지 않는다.
--
-- dev 적용 결과 (2026-09-04)
--   active toy_line 216 -> 81 (archive 124 + kind 교정 11)
--   archive 대상 시리즈의 상품 700건이 전부 line 카테고리를 유지 (분류 손실 0)

-- 1) 완전히 커버된 toy_line 시리즈 archive
update public.gacha_series s
set status = 'archived',
    is_browsable = false,
    note = coalesce(s.note || ' | ', '') || 'archived 2026-09-04: superseded by gacha_categories(category_type=line)',
    updated_at = now()
where s.kind = 'toy_line'
  and s.status = 'active'
  and exists (select 1 from public.gacha_product_series ps where ps.series_id = s.id)
  and not exists (
    select 1
    from public.gacha_product_series ps
    where ps.series_id = s.id
      and not exists (
        select 1
        from public.gacha_product_categories pc
        join public.gacha_categories c on c.id = pc.category_id
        where pc.product_id = ps.product_id
          and c.category_type = 'line'
      )
  );

-- 2) IP 오분류 교정
--    아래는 가챠 종류가 아니라 실제 IP/브랜드다. toy_line 이 아니라 시리즈로 남아야 한다.
--    리카(Licca) 계열 5건은 표기가 흔들려 별개 시리즈로 쪼개져 있다. 병합은 후속 과제로 남긴다.
update public.gacha_series
set kind = 'character_brand',
    kind_source = 'manual',
    kind_confidence = 1,
    note = coalesce(note || ' | ', '') || 'kind fixed 2026-09-04: IP, not a product line',
    updated_at = now()
where status = 'active'
  and kind = 'toy_line'
  and name_ko in (
    '리카짱', '리카', '리카의 옷장', '리카 산리오 캐릭터', '리카짱 옷장 시리즈',
    '레트로 퍼비', '산리오 헬로키티 봉제인형 볼체인'
  );

update public.gacha_series
set kind = 'franchise',
    kind_source = 'manual',
    kind_confidence = 1,
    note = coalesce(note || ' | ', '') || 'kind fixed 2026-09-04: IP, not a product line',
    updated_at = now()
where status = 'active'
  and kind = 'toy_line'
  and name_ko in ('플라레일', '디즈니 모터스', '레고 미니피겨 시리즈 3 ~사이드 B~');

update public.gacha_series
set kind = 'anime',
    kind_source = 'manual',
    kind_confidence = 1,
    note = coalesce(note || ' | ', '') || 'kind fixed 2026-09-04: IP, not a product line',
    updated_at = now()
where status = 'active'
  and kind = 'toy_line'
  and name_ko = '릴릴 페어릴 ~요정의 문~';
