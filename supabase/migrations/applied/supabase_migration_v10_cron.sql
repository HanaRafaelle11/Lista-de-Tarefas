-- =======================================================
-- MIGRATION: CRON SCHEDULER FOR EDGE FUNCTION WORKER (V10)
-- 100% Autonomous Production Triggering Every 1 Minute
-- =======================================================

-- 1. Habilitar extensões necessárias no Postgres (se disponíveis)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Agendar execução da Edge Function a cada 1 minuto (*/1 * * * *)
SELECT cron.schedule(
  'process-notification-queue-job',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://' || current_setting('request.headers')::json->>'host' || '/functions/v1/process-notification-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Executa o worker autônomo de push notifications a cada 60 segundos sem depender do frontend';
