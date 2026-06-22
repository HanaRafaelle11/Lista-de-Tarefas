-- ====================================================================
-- MIGRATION: LINTER SECURITY HARDENING (V12)
-- ====================================================================

-- 1. Lock search_path to public for private security definer functions
ALTER FUNCTION public.get_admin_dashboard_metrics() SET search_path = public;
ALTER FUNCTION public.get_user_detail_metrics(uuid) SET search_path = public;
ALTER FUNCTION public.get_admin_users_list() SET search_path = public;
ALTER FUNCTION public.refresh_analytics_materialized_views() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- 2. Revoke execution privileges from public and anon
REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_detail_metrics(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_users_list() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_analytics_materialized_views() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM public, anon;

-- 3. Explicitly grant permissions back to authorized roles
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_detail_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_users_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;

-- 4. Revoke SELECT on analytical materialized views from anon, authenticated, and public
REVOKE SELECT ON public.mv_active_users_daily FROM anon, authenticated, public;
REVOKE SELECT ON public.mv_active_users_weekly FROM anon, authenticated, public;
REVOKE SELECT ON public.mv_active_users_monthly FROM anon, authenticated, public;
REVOKE SELECT ON public.mv_retention_metrics FROM anon, authenticated, public;
REVOKE SELECT ON public.mv_monetization_metrics FROM anon, authenticated, public;

-- 5. Grant SELECT on analytical materialized views to service_role (for admin analytics)
GRANT SELECT ON public.mv_active_users_daily TO service_role;
GRANT SELECT ON public.mv_active_users_weekly TO service_role;
GRANT SELECT ON public.mv_active_users_monthly TO service_role;
GRANT SELECT ON public.mv_retention_metrics TO service_role;
GRANT SELECT ON public.mv_monetization_metrics TO service_role;

-- 6. RLS Policies for billing_events table
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read own billing events" ON public.billing_events;
CREATE POLICY "Allow users to read own billing events" 
  ON public.billing_events FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow admins to read all billing events" ON public.billing_events;
CREATE POLICY "Allow admins to read all billing events" 
  ON public.billing_events FOR SELECT 
  TO authenticated 
  USING (
    (auth.jwt()->>'email' = 'admin@flowday.app') OR 
    (auth.jwt()->>'email' = 'rafaelle@flowday.app') OR 
    (auth.jwt()->>'email' = 'rafox@flowday.app')
  );

DROP POLICY IF EXISTS "Allow authenticated users to insert own billing events" ON public.billing_events;
CREATE POLICY "Allow authenticated users to insert own billing events" 
  ON public.billing_events FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- 7. Conditional RLS policies for user_activity_logs (dynamically applied if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_activity_logs') THEN
    -- Enable RLS
    ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Allow users to read own activity logs" ON public.user_activity_logs;
    DROP POLICY IF EXISTS "Allow admins to read all activity logs" ON public.user_activity_logs;
    DROP POLICY IF EXISTS "Allow authenticated users to insert own activity logs" ON public.user_activity_logs;
    
    -- Create policies
    CREATE POLICY "Allow users to read own activity logs" 
      ON public.user_activity_logs FOR SELECT 
      TO authenticated 
      USING (auth.uid() = user_id);
      
    CREATE POLICY "Allow admins to read all activity logs" 
      ON public.user_activity_logs FOR SELECT 
      TO authenticated 
      USING (
        (auth.jwt()->>'email' = 'admin@flowday.app') OR 
        (auth.jwt()->>'email' = 'rafaelle@flowday.app') OR 
        (auth.jwt()->>'email' = 'rafox@flowday.app')
      );
      
    CREATE POLICY "Allow authenticated users to insert own activity logs" 
      ON public.user_activity_logs FOR INSERT 
      TO authenticated 
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 8. Re-publish schema to PostgREST cache
NOTIFY pgrst, 'reload schema';
