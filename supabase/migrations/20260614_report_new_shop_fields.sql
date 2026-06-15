alter table reports
  add column if not exists proposed_shop_name text,
  add column if not exists proposed_address text,
  add column if not exists proposed_lat double precision,
  add column if not exists proposed_lng double precision;
