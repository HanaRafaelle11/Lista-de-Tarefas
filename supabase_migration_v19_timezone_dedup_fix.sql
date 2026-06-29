-- =======================================================
-- MIGRATION: TIMEZONE PRECISION & TRIGGER DEDUPLICATION (V19)
-- Eliminates duplicate triggers on tasks table & enforces UTC idempotency
-- =======================================================

-- 1. LIMPEZA DEFINITIVA DE TODAS AS TRIGGERS LEGADAS/DUPLICADAS EM PUBLIC.TASKS
DROP TRIGGER IF EXISTS task_notifications_trigger ON public.tasks;
DROP TRIGGER IF EXISTS task_events_trigger ON public.tasks;
DROP TRIGGER IF EXISTS trg_tasks_event_publisher ON public.tasks;
DROP TRIGGER IF EXISTS trg_task_notifications ON public.tasks;
DROP TRIGGER IF EXISTS trg_tasks_eda ON public.tasks;

-- 2. FUNÇÃO E TRIGGER CANÔNICA ÚNICA (TRG_TASKS_UNIFIED_EDA)
CREATE OR REPLACE FUNCTION public.trg_tasks_unified_eda_func()
RETURNS TRIGGER AS $$
DECLARE
  v_sched_time TIMESTAMPTZ;
  v_key TEXT;
BEGIN
  -- DELETE TASK: Cancela agendamentos ativos na notification_queue
  IF TG_OP = 'DELETE' THEN
    UPDATE public.notification_queue
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE entity_type = 'task' AND entity_id = OLD.id::text AND status = 'pending';
    RETURN OLD;
  END IF;

  -- UPDATE TASK: Cancela agendamentos pendentes anteriores para a mesma tarefa
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.notification_queue
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE entity_type = 'task' AND entity_id = NEW.id::text AND status = 'pending';
  END IF;

  -- INSERT OU UPDATE COM DUE_DATE VALIDA E TAREFA NÃO CONCLUÍDA
  IF (NEW.due_date IS NOT NULL AND (NEW.completed IS NOT TRUE)) THEN
    
    -- Lembrete 1: Na Hora Exata (scheduled_for derivado diretamente do NEW.due_date em UTC)
    v_key := 'task_due_' || NEW.id::text || '_' || NEW.due_date::text || '_ontime';
    INSERT INTO public.notification_queue (
      event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key
    ) VALUES (
      'TASK_DUE', 'task', NEW.id::text, NEW.user_id, NEW.title, 
      COALESCE(NEW.description, 'Sua tarefa vence agora no MyFlowDay.'),
      to_jsonb(NEW), NEW.due_date::TIMESTAMPTZ, 'high', v_key
    ) ON CONFLICT (idempotency_key) DO UPDATE
    SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = now();

    -- Lembrete 2: 15 Minutos Antes (se scheduled_for for no futuro)
    v_sched_time := NEW.due_date::TIMESTAMPTZ - INTERVAL '15 minutes';
    IF (v_sched_time > now()) THEN
      v_key := 'task_due_' || NEW.id::text || '_' || NEW.due_date::text || '_15min';
      INSERT INTO public.notification_queue (
        event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key
      ) VALUES (
        'TASK_DUE', 'task', NEW.id::text, NEW.user_id, '⏰ Tarefa em 15 minutos', 
        '"' || NEW.title || '" vence em breve no MyFlowDay.',
        to_jsonb(NEW), v_sched_time, 'normal', v_key
      ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. VINCULAR A ÚNICA TRIGGER CANÔNICA À TABELA TASKS
CREATE TRIGGER trg_tasks_unified_eda
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_tasks_unified_eda_func();

COMMENT ON FUNCTION public.trg_tasks_unified_eda_func IS 'Única trigger canônica desacoplada e idempotente para a tabela tasks no Postgres';
