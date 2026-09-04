-- 라인 접두어(예: 오네무탄) + 진짜 IP 통짜 시리즈를 진짜 IP 시리즈로 병합 (2026-08-26).
--
-- 문제: "오네무탄 귀멸의 칼날" 같은 콜라보 상품명은 파서가 series 를 하나로만 뽑아서
--       진짜 IP 시리즈("귀멸의 칼날", 71건)에 안 걸리고 별도 고아 시리즈(13건)로 떨어졌다.
--       실측: line 카테고리 접두어로 시작하고, 접두어를 뗀 나머지가 기존 활성 시리즈
--       이름과 정확히(또는 name_ko_norm 으로) 일치하는 9쌍을 확인.
--
-- 코덱스 adversarial review 완료: 9쌍 모두 동일 IP로 판단, 우연한 이름 충돌 없음.
-- "블루록"(child, 공백없음)/"블루 록"(parent, 공백있음) 쌍만 name_ko_norm 충돌 여부를
-- 사전 확인했고 충돌 없음 확인됨.
--
-- 병합해도 "오네무탄 콜라보였다"는 정보는 안 사라진다 — gacha_categories(line=오네무탄)
-- 이 이미 상품별로 정확히 붙어 있어서 category 축에서 보존된다.
--
-- 알려진 한계 (코덱스 지적): 파서가 다음 수집에서도 "오네무탄 귀멸의 칼날"을 통짜로
-- 뽑으면 upsert 가 archived 된 이 시리즈를 못 찾고 새 시리즈를 또 만들 수 있다.
-- 이번 병합은 기존 데이터 정리일 뿐이고, 재발 방지는 gacha-collector 쪽 upsert
-- resolver 를 별도로 고쳐야 한다 (후속 작업).

update public.gacha_series
set status = 'archived',
    merged_into_id = (case name_ko
      when '오네무탄 괴수 8호' then '1b84df87-22f9-474b-aece-d9db60111ff6'
      when '오네무탄 귀멸의 칼날' then '9e4eadc0-dcc5-4318-acc6-ec8e3d9dddd6'
      when '오네무탄 극장판 주술회전 0' then 'f5bfa42c-5399-4488-ace6-f76a4ff7fd59'
      when '오네무탄 나의 히어로 아카데미아' then '1887b052-4277-4db3-bb62-fb073607e206'
      when '오네무탄 블루록' then 'a39ff180-60c6-46ae-b3a0-e349c67ad702'
      when '오네무탄 주문은 토끼입니까?' then 'c8785b92-99ea-430a-b2ce-46f3db9629d5'
      when '오네무탄 주술회전' then '29765e26-41c5-46ad-b893-73a47afc76b4'
      when '오네무탄 컬러풀피치' then 'b58ef50b-2b63-40dc-b2c7-0a015e43a110'
      when '오네무탄 하이큐!!' then '62d4a59b-426d-414f-af94-831808d78908'
    end)::uuid,
    is_browsable = false,
    note = coalesce(note || E'\n', '') || 'manual_merge_20260826_line_prefix_collab: merged into matching IP series',
    updated_at = now()
where name_ko in (
  '오네무탄 괴수 8호',
  '오네무탄 귀멸의 칼날',
  '오네무탄 극장판 주술회전 0',
  '오네무탄 나의 히어로 아카데미아',
  '오네무탄 블루록',
  '오네무탄 주문은 토끼입니까?',
  '오네무탄 주술회전',
  '오네무탄 컬러풀피치',
  '오네무탄 하이큐!!'
)
and status = 'active';

select public.refresh_gacha_product_series();
select public.refresh_gacha_browse_views();
