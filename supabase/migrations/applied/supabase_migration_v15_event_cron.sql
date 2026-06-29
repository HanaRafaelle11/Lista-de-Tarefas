-- =======================================================
-- MIGRATION: CRON SCHEDULER FOR PROCESS-EVENTS WORKER (V15)
-- Continuous Execution Every Minute (* * * * *)
-- =======================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'process-events-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/process-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Invocador automático da Edge Function orquestradora do Event Bus a cada minuto';
