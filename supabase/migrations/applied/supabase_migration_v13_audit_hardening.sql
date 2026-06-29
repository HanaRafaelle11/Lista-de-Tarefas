-- =======================================================
-- MIGRATION: HARDENING & AUDIT ALIGNMENT (V13)
-- Full Web Push Autonomous Production Readiness & Observability
-- =======================================================

-- 1. ADICIONAR COLUNAS DE EXPIRAÇÃO E SUBSCRIPTION SE FALTAREM
ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS expiration_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expirationTime TIMESTAMPTZ;

-- 2. EXPANDIR TABELA DE OBSERVABILIDADE (NOTIFICATION_LOGS)
ALTER TABLE public.notification_logs
ADD COLUMN IF NOT EXISTS job_id TEXT,
ADD COLUMN IF NOT EXISTS subscription TEXT,
ADD COLUMN IF NOT EXISTS tempo_execucao INT,
ADD COLUMN IF NOT EXISTS payload JSONB;

-- 3. ALIASING DE FUNÇÃO E TRIGGER POSTGRES PARA COMPATIBILIDADE DE AUDITORIA
CREATE OR REPLACE FUNCTION public.handle_task_events()
RETURNS TRIGGER AS $$
BEGIN
  RETURN public.handle_task_notifications();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS task_events_trigger ON public.tasks;
CREATE TRIGGER task_events_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_task_events();

COMMENT ON FUNCTION public.handle_task_events IS 'Alias de função e trigger para auditoria técnica de eventos de tarefas no Postgres';
