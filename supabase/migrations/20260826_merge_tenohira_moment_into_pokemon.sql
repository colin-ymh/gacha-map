-- "てのひらモーメント"(손바닥 모먼트) 타카라토미아츠 캡슐토이 라인의 포켓몬 콜라보 4건을
-- 포켓몬스터 시리즈로 병합 (2026-08-26).
--
-- 발견 경위: 사용자가 dev 앱 시리즈 목록에서 "포켓몬 도는 손바닥 모먼트"라는 이상한
-- 이름을 발견. 조사 결과 series.ja 는 "てのひらモーメント"로 깨끗이 뽑혔지만(라인명만,
-- IP 안 섞임), series.ko 번역이 상품 4개마다 전부 다르게 망가짐(포켓몬 포 퀵기분 모먼트 /
-- 포켓몬 파트(텐히라 모멘트) / 포켓몬 도는 손바닥 모먼트 / 포켓몬 모두 함께 선물 마스코트).
-- ip-title-mapping.json 에 이 라인명이 없어 LLM 이 매번 즉흥 번역했고, 이후 alias-merge
-- 단계에서 4개가 하나로 합쳐지면서 가장 이상한 이름이 대표명으로 남음.
--
-- 처리: 현재 이 라인은 포켓몬 콜라보만 4건 존재(다른 IP 없음) — 별도 line 카테고리로
-- 분리할 만큼 반복성이 확인되지 않아, 사용자 판단대로 그냥 포켓몬스터 시리즈로 합친다.
-- 나중에 다른 IP 콜라보로 이 라인명이 다시 나타나면 그때 line 카테고리 분리를 재검토한다.

update public.gacha_series
set status = 'archived',
    merged_into_id = 'e314da18-c260-4607-a71a-d85ad1c650ed', -- 포켓몬스터
    is_browsable = false,
    note = coalesce(note || E'\n', '') || 'manual_merge_20260826_tenohira_moment: ja=てのひらモーメント Pokemon collab line, merged into 포켓몬스터 (ko transliteration was inconsistent garbage across 4 products)',
    updated_at = now()
where id = 'dbae16e7-3f1b-438a-989a-889c65ef54f5' -- 포켓몬 도는 손바닥 모먼트
  and status = 'active';

select public.refresh_gacha_product_series();
select public.refresh_gacha_browse_views();
