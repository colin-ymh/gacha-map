-- shops: 누락 컬럼 추가
alter table shops
  add column if not exists is_authorized boolean not null default false,
  add column if not exists place_id text;

-- reports: report_type 컬럼 추가
alter table reports
  add column if not exists report_type text not null default 'other'
    check (report_type in ('new_shop', 'fix_info', 'closed', 'other'));
