-- =======================================================
-- MIGRATION: LINTER & STORAGE HARDENING (V38 - CORRIGIDA)
-- Objetivo: Revogar privilégios públicos de funções Security Definer,
-- restringir listagem no bucket 'avatars' e corrigir políticas RLS.
-- =======================================================

-- ── 1. RESTRIÇÃO DE EXECUÇÃO DE FUNÇÕES SENSÍVEIS (SECURITY DEFINER) ──

-- A) public.handle_task_events
REVOKE EXECUTE ON FUNCTION public.handle_task_events() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_task_events() TO service_role;

-- B) public.trg_tasks_unified_eda_func
REVOKE EXECUTE ON FUNCTION public.trg_tasks_unified_eda_func() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_tasks_unified_eda_func() TO service_role;

-- C) public.trg_goals_unified_eda_func
REVOKE EXECUTE ON FUNCTION public.trg_goals_unified_eda_func() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_goals_unified_eda_func() TO service_role;

-- D) public.handle_new_user
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- E) public.parse_metadata
REVOKE EXECUTE ON FUNCTION public.parse_metadata(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parse_metadata(text) TO service_role;

-- F) public.combine_date_time_tz
REVOKE EXECUTE ON FUNCTION public.combine_date_time_tz(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.combine_date_time_tz(text, text) TO service_role;

-- G) public.refresh_analytics_materialized_views
REVOKE EXECUTE ON FUNCTION public.refresh_analytics_materialized_views() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_analytics_materialized_views() TO service_role;

-- H) public.get_admin_dashboard_metrics
-- Revoga o acesso público/authenticated para limpar o alerta 'authenticated_security_definer_function_executable'
-- Nota: A API Vercel consome esta função via service_role, mantendo o dashboard operacional.
REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO service_role;

-- I) public.get_admin_users_list
REVOKE EXECUTE ON FUNCTION public.get_admin_users_list() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_users_list() TO service_role;

-- J) public.get_user_detail_metrics
REVOKE EXECUTE ON FUNCTION public.get_user_detail_metrics(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_detail_metrics(uuid) TO service_role;


-- ── 2. AJUSTE NA POLÍTICA RLS DA TABELA push_telemetry ──

-- Garantir RLS ativo
ALTER TABLE public.push_telemetry ENABLE ROW LEVEL SECURITY;

-- Remover e recriar política de INSERT restringindo o user_id
DROP POLICY IF EXISTS "Allow authenticated inserts" ON public.push_telemetry;
DROP POLICY IF EXISTS "Allow authenticated users to insert telemetry" ON public.push_telemetry;

CREATE POLICY "Allow authenticated inserts"
  ON public.push_telemetry FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- ── 3. RESTRIÇÃO DE LISTAGEM DE ARQUIVOS (BUCKET avatars) ──

-- Remover a política antiga de leitura irrestrita
DROP POLICY IF EXISTS "Allow public read of avatars" ON storage.objects;

-- Criar a nova política de SELECT: permite leitura apenas se o usuário for o dono do arquivo
-- (Impede a listagem ampla/broad select de avatars de terceiros por API, mas mantém download via CDN público pois a bucket é pública)
CREATE POLICY "Allow public read of avatars"
  ON storage.objects FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ── 4. POLÍTICAS DE RLS PARA EVITAR ALERTA rls_enabled_no_policy ──

-- A) public.billing_idempotency
DROP POLICY IF EXISTS "Allow service_role full access on billing_idempotency" ON public.billing_idempotency;
CREATE POLICY "Allow service_role full access on billing_idempotency"
  ON public.billing_idempotency FOR ALL TO service_role USING (true) WITH CHECK (true);

-- B) public.billing_locks
DROP POLICY IF EXISTS "Allow service_role full access on billing_locks" ON public.billing_locks;
CREATE POLICY "Allow service_role full access on billing_locks"
  ON public.billing_locks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- C) public.billing_traces
DROP POLICY IF EXISTS "Allow service_role full access on billing_traces" ON public.billing_traces;
CREATE POLICY "Allow service_role full access on billing_traces"
  ON public.billing_traces FOR ALL TO service_role USING (true) WITH CHECK (true);

-- D) public.growth_action_results
DROP POLICY IF EXISTS "Allow service_role full access on growth_action_results" ON public.growth_action_results;
CREATE POLICY "Allow service_role full access on growth_action_results"
  ON public.growth_action_results FOR ALL TO service_role USING (true) WITH CHECK (true);

-- E) public.growth_actions
DROP POLICY IF EXISTS "Allow service_role full access on growth_actions" ON public.growth_actions;
CREATE POLICY "Allow service_role full access on growth_actions"
  ON public.growth_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- F) public.payment_events
DROP POLICY IF EXISTS "Allow service_role full access on payment_events" ON public.payment_events;
CREATE POLICY "Allow service_role full access on payment_events"
  ON public.payment_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- G) public.revenue_leaks
DROP POLICY IF EXISTS "Allow service_role full access on revenue_leaks" ON public.revenue_leaks;
CREATE POLICY "Allow service_role full access on revenue_leaks"
  ON public.revenue_leaks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- H) public.user_risk_profile
DROP POLICY IF EXISTS "Allow service_role full access on user_risk_profile" ON public.user_risk_profile;
CREATE POLICY "Allow service_role full access on user_risk_profile"
  ON public.user_risk_profile FOR ALL TO service_role USING (true) WITH CHECK (true);
