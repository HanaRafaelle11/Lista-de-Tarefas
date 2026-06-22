-- ====================================================================
-- MIGRATION: SECURE ANALYTICS VIEWS AND MATERIALIZED VIEWS (V11)
-- ====================================================================

-- 1. Revoke public access to mv_retention_metrics to prevent exposing auth.users details
REVOKE SELECT ON public.mv_retention_metrics FROM anon, authenticated, public;

-- 2. Revoke public access to all financial analytics views to protect sensitive MRR and user churn aggregates
REVOKE SELECT ON public.vw_mrr_metrics FROM anon, authenticated, public;
REVOKE SELECT ON public.vw_churn_metrics FROM anon, authenticated, public;
REVOKE SELECT ON public.vw_arpu_metrics FROM anon, authenticated, public;
REVOKE SELECT ON public.vw_cohort_retention FROM anon, authenticated, public;
REVOKE SELECT ON public.vw_growth_metrics FROM anon, authenticated, public;

-- 3. Explicitly grant permissions to service_role to ensure backend/admin functions continue to work
GRANT SELECT ON public.mv_retention_metrics TO service_role;
GRANT SELECT ON public.vw_mrr_metrics TO service_role;
GRANT SELECT ON public.vw_churn_metrics TO service_role;
GRANT SELECT ON public.vw_arpu_metrics TO service_role;
GRANT SELECT ON public.vw_cohort_retention TO service_role;
GRANT SELECT ON public.vw_growth_metrics TO service_role;

-- Re-publish schema to PostgREST cache
NOTIFY pgrst, 'reload schema';
