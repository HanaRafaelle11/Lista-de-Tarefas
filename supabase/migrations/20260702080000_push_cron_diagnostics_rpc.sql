-- =========================================================================
-- DIAGNOSTICS: RPC check_push_cron_status (20260702080000)
-- =========================================================================
-- Cria uma função RPC segura no schema public que permite ao time de 
-- engenharia auditar a saúde das extensões pg_cron/pg_net, verificar
-- os jobs ativos, ver os logs de execuções anteriores e inspecionar
-- as respostas HTTP reais das Edge Functions de segundo plano.

CREATE OR REPLACE FUNCTION public.check_push_cron_status()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cron_enabled boolean;
  net_enabled boolean;
  jobs_list jsonb;
  job_runs jsonb;
  net_responses jsonb;
  net_errors jsonb;
BEGIN
  -- 1. Verificar instalação das extensões
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO cron_enabled;
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_net') INTO net_enabled;
  
  -- 2. Listar jobs agendados no pg_cron
  BEGIN
    SELECT jsonb_agg(to_jsonb(j)) 
    FROM (
      SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname 
      FROM cron.job
    ) j INTO jobs_list;
  EXCEPTION WHEN OTHERS THEN
    jobs_list := '[]'::jsonb;
  END;

  -- 3. Obter as 10 execuções mais recentes dos cron jobs
  BEGIN
    SELECT jsonb_agg(to_jsonb(r)) 
    FROM (
      SELECT jobid, runid, username, status, return_message, start_time, end_time 
      FROM cron.job_run_details 
      ORDER BY start_time DESC 
      LIMIT 10
    ) r INTO job_runs;
  EXCEPTION WHEN OTHERS THEN
    job_runs := '[]'::jsonb;
  END;

  -- 4. Obter as 10 respostas HTTP mais recentes do pg_net (Respostas das Edge Functions)
  BEGIN
    SELECT jsonb_agg(to_jsonb(n)) 
    FROM (
      SELECT id, status_code, status_text, created_at
      FROM net.http_responses
      ORDER BY created_at DESC
      LIMIT 10
    ) n INTO net_responses;
  EXCEPTION WHEN OTHERS THEN
    net_responses := '[]'::jsonb;
  END;

  -- 5. Obter erros de rede recentes do pg_net
  BEGIN
    SELECT jsonb_agg(to_jsonb(e))
    FROM (
      SELECT id, error_message, created_at
      FROM net.http_errors
      ORDER BY created_at DESC
      LIMIT 10
    ) e INTO net_errors;
  EXCEPTION WHEN OTHERS THEN
    net_errors := '[]'::jsonb;
  END;

  -- Retorna relatório agregado
  RETURN jsonb_build_object(
    'timestamp', now(),
    'pg_cron_installed', cron_enabled,
    'pg_net_installed', net_enabled,
    'active_jobs', COALESCE(jobs_list, '[]'::jsonb),
    'recent_executions', COALESCE(job_runs, '[]'::jsonb),
    'recent_http_responses', COALESCE(net_responses, '[]'::jsonb),
    'recent_http_errors', COALESCE(net_errors, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.check_push_cron_status() IS 'Audita a infraestrutura de agendamento em segundo plano (pg_cron + pg_net) no Supabase.';
