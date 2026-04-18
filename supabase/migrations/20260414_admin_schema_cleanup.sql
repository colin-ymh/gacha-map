-- shops.status: default 'pending' 버그 수정 ('pending'은 check constraint에 없음)
alter table shops alter column status set default 'active';

-- duplicate_candidates 테이블 제거 (중복 검토는 이 프로젝트 범위 밖)
drop table if exists duplicate_candidates;
