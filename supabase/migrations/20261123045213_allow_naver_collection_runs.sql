-- Resume existing Naver place collection using the same durable target ledger.
-- No policies, grants, rows, columns or existing source values are changed.
SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE public.collection_runs
  DROP CONSTRAINT collection_runs_source_check,
  ADD CONSTRAINT collection_runs_source_check
    CHECK (source IN ('kakao', 'google', 'naver'));

RESET lock_timeout;
RESET statement_timeout;
