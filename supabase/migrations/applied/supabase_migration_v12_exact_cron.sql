-- =======================================================
-- MIGRATION: CRON JOB FOR EDGE FUNCTION EXECUTION (V12)
-- Continuous Execution Every Minute (* * * * *)
-- =======================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/process-notification-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Executa automaticamente o worker de push notifications a cada minuto sem intervenção humana';
