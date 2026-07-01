-- =========================================================================
-- SCRIPT DE ATIVAÇÃO DOS CRON JOBS (AGENDADOR DE PUSH E EVENTOS)
-- =========================================================================
-- Execute este script no SQL Editor do seu Dashboard do Supabase para
-- automatizar o processamento de notificações de minuto em minuto.

-- 1. Habilitar extensões necessárias (se ainda não estiverem habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remover agendamentos obsoletos/antigos por precaução (apenas se existirem)
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname IN ('process-notification-queue', 'process-events-job');

-- 3. Agendar processador de fila de notificações (process-notification-queue)
SELECT cron.schedule(
  'process-notification-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mftsklhrzhhvtsuamqaw.supabase.co/functions/v1/process-notification-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mdHNrbGhyemhodnRzdWFtcWF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIxMjQwNSwiZXhwIjoyMDk2Nzg4NDA1fQ.KS_4QJR8TW02XZqPdwX05uR3jlZK_LsKLXjpDuHH45c'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 4. Agendar processador de eventos (process-events)
SELECT cron.schedule(
  'process-events-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mftsklhrzhhvtsuamqaw.supabase.co/functions/v1/process-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mdHNrbGhyemhodnRzdWFtcWF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTIxMjQwNSwiZXhwIjoyMDk2Nzg4NDA1fQ.KS_4QJR8TW02XZqPdwX05uR3jlZK_LsKLXjpDuHH45c'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 5. Adicionar comentários de documentação
COMMENT ON EXTENSION pg_cron IS 'Executa os jobs automatizados do MyFlowDay de minuto em minuto no Supabase.';
