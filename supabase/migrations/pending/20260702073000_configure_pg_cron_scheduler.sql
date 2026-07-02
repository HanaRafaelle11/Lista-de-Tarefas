-- =========================================================================
-- MIGRATION: Configure pg_cron scheduler (20260702073000)
-- =========================================================================
-- Habilita a extensão pg_cron e configura agendamento nativo no banco
-- para contornar os limites do plano Hobby da Vercel.

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Limpar agendamentos obsoletos
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname IN ('process-notification-queue', 'process-events-job');

-- 3. Agendar processador de fila de notificações (a cada 5 minutos)
SELECT cron.schedule(
  'process-notification-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mftsklhrzhhvtsuamqaw.supabase.co/functions/v1/process-notification-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', (SELECT 'Bearer ' || decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' OR name ILIKE '%service_role%' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 4. Agendar processador de eventos de crescimento/faturamento (a cada 10 minutos)
SELECT cron.schedule(
  'process-events-job',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mftsklhrzhhvtsuamqaw.supabase.co/functions/v1/process-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', (SELECT 'Bearer ' || decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' OR name ILIKE '%service_role%' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Agendador de tarefas em segundo plano do MyFlowDay nativo no Supabase Postgres.';
