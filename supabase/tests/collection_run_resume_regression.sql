-- Run as an isolated transaction: no synthetic collection rows persist.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  test_run uuid := gen_random_uuid();
  accepted integer;
BEGIN
  INSERT INTO public.collection_runs (run_id, mode, source, query, status, result_count)
  VALUES
    (test_run, 'standard', 'naver', '__collector_resume_regression__', 'success', 0),
    (test_run, 'standard', 'kakao', '__collector_resume_regression__', 'success', 0),
    (test_run, 'supplement-pilot', 'google', '__collector_resume_regression__', 'failure', 0);
  SELECT count(*) INTO accepted FROM public.collection_runs WHERE run_id = test_run;
  IF accepted <> 3 THEN RAISE EXCEPTION 'Valid collection records rejected'; END IF;
  BEGIN
    INSERT INTO public.collection_runs (run_id, mode, source, query, status)
    VALUES (test_run, 'standard', 'invalid_source', '__collector_resume_regression__', 'success');
    RAISE EXCEPTION 'Invalid source accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.collection_runs (run_id, mode, source, query, status)
    VALUES (test_run, 'standard', 'naver', '__collector_resume_regression__', 'invalid_status');
    RAISE EXCEPTION 'Invalid status accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
ROLLBACK;
