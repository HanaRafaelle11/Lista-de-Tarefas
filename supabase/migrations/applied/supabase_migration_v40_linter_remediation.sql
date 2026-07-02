-- =======================================================
-- MIGRATION V40: SUPABASE LINTER REMEDIATION (HARDENING)
-- Corrige alertas 0024 (RLS permissiva), 0029 (SECURITY DEFINER
-- exposta) e 0014 (pg_net no schema public).
-- =======================================================

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  1. RESTRIÇÃO DE RLS NA public.notification_queue (0024)    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Garantir RLS ativo
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas antigas (incluindo a permissiva "USING(true)")
DROP POLICY IF EXISTS "Permitir leitura e atualizacao da fila" ON public.notification_queue;
DROP POLICY IF EXISTS "Allow service_role full access" ON public.notification_queue;
DROP POLICY IF EXISTS "Allow users to read own notifications" ON public.notification_queue;
DROP POLICY IF EXISTS "Allow users to insert own notifications" ON public.notification_queue;
DROP POLICY IF EXISTS "Allow users to update own notifications" ON public.notification_queue;
DROP POLICY IF EXISTS "Allow users to delete own notifications" ON public.notification_queue;

-- A) service_role: acesso total (Edge Functions, pg_cron, triggers SECURITY DEFINER)
CREATE POLICY "service_role_full_access_notification_queue"
  ON public.notification_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- B) authenticated: SELECT restrito ao próprio user_id
CREATE POLICY "authenticated_select_own_notification_queue"
  ON public.notification_queue FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- C) authenticated: INSERT restrito ao próprio user_id
--    (triggers SECURITY DEFINER inserem como service_role, então
--     essa regra só vale para inserções diretas da API do cliente)
CREATE POLICY "authenticated_insert_own_notification_queue"
  ON public.notification_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- D) authenticated: UPDATE restrito ao próprio user_id
CREATE POLICY "authenticated_update_own_notification_queue"
  ON public.notification_queue FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- E) authenticated: DELETE restrito ao próprio user_id
CREATE POLICY "authenticated_delete_own_notification_queue"
  ON public.notification_queue FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Revogar GRANT excessivo que existia em v39
-- (o service_role já ignora RLS, mas limpar os GRANTs diretos
--  impede que authenticated acesse sem passar pela policy)
REVOKE INSERT, UPDATE, DELETE ON public.notification_queue FROM authenticated;
GRANT SELECT ON public.notification_queue TO authenticated;
GRANT ALL ON public.notification_queue TO service_role;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2. PROTEÇÃO DE FUNÇÕES SECURITY DEFINER (0029)             ║
-- ║     Revogar EXECUTE de authenticated/public/anon             ║
-- ╚══════════════════════════════════════════════════════════════╝

-- A) get_admin_dashboard_metrics()
REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO service_role;

-- B) get_admin_users_list()
REVOKE EXECUTE ON FUNCTION public.get_admin_users_list() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_users_list() TO service_role;

-- C) get_user_detail_metrics(uuid)
REVOKE EXECUTE ON FUNCTION public.get_user_detail_metrics(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_detail_metrics(uuid) TO service_role;

-- D) refresh_analytics_materialized_views()
REVOKE EXECUTE ON FUNCTION public.refresh_analytics_materialized_views() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_analytics_materialized_views() TO service_role;

-- E) calculate_business_health_score() — chamada interna por get_admin_dashboard_metrics
--    (pode não existir se a migration v26 não foi aplicada)
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.calculate_business_health_score() FROM public, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.calculate_business_health_score() TO service_role;
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE '[V40] calculate_business_health_score() não existe, pulando.';
END;
$$;

-- F) handle_task_events() — trigger function
REVOKE EXECUTE ON FUNCTION public.handle_task_events() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_task_events() TO service_role;

-- G) trg_tasks_unified_eda_func() — trigger function
REVOKE EXECUTE ON FUNCTION public.trg_tasks_unified_eda_func() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_tasks_unified_eda_func() TO service_role;

-- H) trg_goals_unified_eda_func() — trigger function
REVOKE EXECUTE ON FUNCTION public.trg_goals_unified_eda_func() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_goals_unified_eda_func() TO service_role;

-- I) handle_new_user() — trigger function
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- J) parse_metadata(text) — helper, chamada por triggers
REVOKE EXECUTE ON FUNCTION public.parse_metadata(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parse_metadata(text) TO service_role;

-- K) combine_date_time_tz(text, text) — helper, chamada por triggers
REVOKE EXECUTE ON FUNCTION public.combine_date_time_tz(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.combine_date_time_tz(text, text) TO service_role;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  3. MOVER pg_net PARA SCHEMA DEDICADO (0014)                ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Criar schema dedicado para extensões (se não existir)
CREATE SCHEMA IF NOT EXISTS extensions;

-- Mover pg_net do public para extensions
-- NOTA: No Supabase hosted, ALTER EXTENSION ... SET SCHEMA pode
-- não ser permitido. Se este comando falhar, a alternativa é:
--   DROP EXTENSION pg_net; CREATE EXTENSION pg_net SCHEMA extensions;
-- Porém isso requer que nenhum objeto dependa de pg_net no momento.
DO $$
BEGIN
  -- Tenta mover a extensão para o schema extensions
  BEGIN
    ALTER EXTENSION pg_net SET SCHEMA extensions;
    RAISE NOTICE '[V40] pg_net movida para schema extensions com sucesso.';
  EXCEPTION WHEN OTHERS THEN
    -- Se falhar (ex.: Supabase managed não permite ALTER EXTENSION SET SCHEMA),
    -- tenta drop + recreate
    BEGIN
      DROP EXTENSION IF EXISTS pg_net;
      CREATE EXTENSION pg_net SCHEMA extensions;
      RAISE NOTICE '[V40] pg_net recriada no schema extensions (fallback).';
    EXCEPTION WHEN OTHERS THEN
      -- Se também falhar (dependências ou permissões do hosting),
      -- apenas loga e segue sem quebrar a migration
      RAISE WARNING '[V40] Não foi possível mover pg_net para extensions: %. A extensão permanece em public.', SQLERRM;
    END;
  END;
END;
$$;

-- Revogar uso do schema extensions para roles não-privilegiadas
REVOKE ALL ON SCHEMA extensions FROM public, anon, authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  4. DOCUMENTAÇÃO                                             ║
-- ╚══════════════════════════════════════════════════════════════╝

COMMENT ON POLICY "service_role_full_access_notification_queue"
  ON public.notification_queue
  IS 'V40: Acesso irrestrito para Edge Functions e pg_cron (service_role ignora RLS, mas a policy explicita a intenção).';

COMMENT ON POLICY "authenticated_select_own_notification_queue"
  ON public.notification_queue
  IS 'V40: Usuários autenticados podem ler apenas notificações do próprio user_id.';
