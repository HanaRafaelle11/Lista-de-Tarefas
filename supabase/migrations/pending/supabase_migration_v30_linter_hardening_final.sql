-- ====================================================================
-- MIGRATION: SUPABASE DATABASE LINTER HARDENING & SECURITY (V30)
-- Principal Database Engineer Specification
-- Executar este script no SQL Editor do Supabase Dashboard
-- ====================================================================

-- 1. HARDENING DE FUNÇÕES (SECURITY DEFINER & MUTABLE SEARCH_PATH)
DO $$
BEGIN
  -- get_admin_dashboard_metrics
  IF EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE proname = 'get_admin_dashboard_metrics' AND nspname = 'public') THEN
    ALTER FUNCTION public.get_admin_dashboard_metrics() SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() FROM public, anon;
    GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO authenticated, service_role;
  END IF;

  -- get_user_detail_metrics
  IF EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE proname = 'get_user_detail_metrics' AND nspname = 'public') THEN
    ALTER FUNCTION public.get_user_detail_metrics(uuid) SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.get_user_detail_metrics(uuid) FROM public, anon;
    GRANT EXECUTE ON FUNCTION public.get_user_detail_metrics(uuid) TO authenticated, service_role;
  END IF;

  -- get_admin_users_list
  IF EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE proname = 'get_admin_users_list' AND nspname = 'public') THEN
    ALTER FUNCTION public.get_admin_users_list() SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.get_admin_users_list() FROM public, anon;
    GRANT EXECUTE ON FUNCTION public.get_admin_users_list() TO authenticated, service_role;
  END IF;

  -- refresh_analytics_materialized_views
  IF EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE proname = 'refresh_analytics_materialized_views' AND nspname = 'public') THEN
    ALTER FUNCTION public.refresh_analytics_materialized_views() SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.refresh_analytics_materialized_views() FROM public, anon;
    GRANT EXECUTE ON FUNCTION public.refresh_analytics_materialized_views() TO service_role;
  END IF;
END $$;


-- 2. HARDENING DE RLS: TABELA EVENTS (Privacidade de Telemetria)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.events FROM anon;

DROP POLICY IF EXISTS "Allow authenticated read own events" ON public.events;
CREATE POLICY "Allow authenticated read own events" ON public.events FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow authenticated insert own events" ON public.events;
CREATE POLICY "Allow authenticated insert own events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow service role full access on events" ON public.events;
CREATE POLICY "Allow service role full access on events" ON public.events FOR ALL TO service_role USING (true);


-- 3. HARDENING DE RLS: TABELA BILLING_LEDGER (Proteção de Dados Contábeis)
ALTER TABLE public.billing_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_ledger FROM anon;

DROP POLICY IF EXISTS "Allow authenticated read own billing ledger" ON public.billing_ledger;
CREATE POLICY "Allow authenticated read own billing ledger" ON public.billing_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow service role full access on billing_ledger" ON public.billing_ledger;
CREATE POLICY "Allow service role full access on billing_ledger" ON public.billing_ledger FOR ALL TO service_role USING (true);


-- 4. HARDENING DE RLS: TABELA NOTIFICATION_QUEUE (Privacidade da Fila)
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_queue FROM anon;

DROP POLICY IF EXISTS "Allow authenticated read own notifications" ON public.notification_queue;
CREATE POLICY "Allow authenticated read own notifications" ON public.notification_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow service role full access on notification_queue" ON public.notification_queue;
CREATE POLICY "Allow service role full access on notification_queue" ON public.notification_queue FOR ALL TO service_role USING (true);


-- 5. HARDENING DE RLS: TABELA SCHEMA_MIGRATIONS (Proteção de Metadados de Infraestrutura)
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schema_migrations FROM anon, authenticated, public;

DROP POLICY IF EXISTS "Allow service role full access on schema_migrations" ON public.schema_migrations;
CREATE POLICY "Allow service role full access on schema_migrations" ON public.schema_migrations FOR ALL TO service_role USING (true);


-- 6. RECARGA DO CACHE DE SCHEMAS DO POSTGREST
NOTIFY pgrst, 'reload schema';
