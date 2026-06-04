-- 파이프라인 전용 테이블: RLS 활성화, 정책 없음 → service_role만 접근 가능
-- anon key / authenticated 유저는 접근 불가
ALTER TABLE public.raw_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_place_filter_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_blog_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_filter_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_llm_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_manual_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.normalized_candidates ENABLE ROW LEVEL SECURITY;
-- temporal_shops: 향후 유저 제보 기능 구현 시 별도 정책 추가 필요
ALTER TABLE public.temporal_shops ENABLE ROW LEVEL SECURITY;
