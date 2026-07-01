-- =======================================================
-- MIGRATION: AUTOMATED PUSH NOTIFICATIONS & RLS SECURITY (V36)
-- Enforces row-level security and inserts automatic triggers
-- =======================================================

-- 1. CORREÇÃO DE SEGURANÇA (ATIVAR RLS)
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- Garantir que a política para service_role (robô em background) exista
DROP POLICY IF EXISTS "Allow service_role full access" ON public.notification_queue;
CREATE POLICY "Allow service_role full access" 
  ON public.notification_queue FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- 2. FUNÇÃO E TRIGGER AUXILIARES DE PARSE DE METADADOS
CREATE OR REPLACE FUNCTION public.parse_metadata(p_description text)
RETURNS jsonb AS $$
DECLARE
  v_parts text[];
  v_meta jsonb;
BEGIN
  IF p_description IS NULL OR p_description = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  
  IF position('--flowday-meta--' in p_description) = 0 THEN
    RETURN '{}'::jsonb;
  END IF;
  
  v_parts := string_to_array(p_description, '--flowday-meta--');
  IF array_length(v_parts, 1) < 2 THEN
    RETURN '{}'::jsonb;
  END IF;
  
  BEGIN
    v_meta := trim(v_parts[2])::jsonb;
    RETURN v_meta;
  EXCEPTION WHEN OTHERS THEN
    RETURN '{}'::jsonb;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.combine_date_time_tz(p_date text, p_time text)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  IF p_date IS NULL OR p_date = '' THEN
    RETURN NULL;
  END IF;
  
  -- Se o horário for nulo ou vazio, padrão para 09:00
  IF p_time IS NULL OR p_time = '' THEN
    p_time := '09:00';
  END IF;
  
  -- Verificar se é um horário válido no formato HH:MI
  IF p_time ~ '^[0-9]{2}:[0-9]{2}$' THEN
    -- Converter assumindo fuso horário de Brasília (UTC-3)
    RETURN (p_date || 'T' || p_time || ':00-03:00')::TIMESTAMPTZ;
  ELSE
    RETURN (p_date || 'T09:00:00-03:00')::TIMESTAMPTZ;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. RE-IMPLEMENTAÇÃO DO GATILHO DE TAREFAS (TASKS)
CREATE OR REPLACE FUNCTION public.trg_tasks_unified_eda_func()
RETURNS TRIGGER AS $$
DECLARE
  v_meta jsonb;
  v_due_time text;
  v_sched_time TIMESTAMPTZ;
  v_key text;
BEGIN
  -- Operação de DELEÇÃO (DELETE): Remove notificações da fila
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notification_queue 
    WHERE entity_type = 'task' AND entity_id = OLD.id::text AND status = 'pending';
    RETURN OLD;
  END IF;

  -- Operação de ATUALIZAÇÃO (UPDATE) ou INSERÇÃO (INSERT)
  -- Se concluída ou data removida, limpa os agendamentos anteriores
  IF (TG_OP = 'UPDATE') THEN
    IF (NEW.completed = true OR NEW.due_date IS NULL OR NEW.due_date = '') THEN
      DELETE FROM public.notification_queue 
      WHERE entity_type = 'task' AND entity_id = NEW.id::text AND status = 'pending';
    END IF;
  END IF;

  -- Se possui prazo válido e não está concluída, agenda notificações
  IF (NEW.due_date IS NOT NULL AND NEW.due_date <> '' AND (NEW.completed IS NOT TRUE)) THEN
    -- Extrair horário da descrição metadata
    v_meta := public.parse_metadata(NEW.description);
    v_due_time := v_meta->>'due_time';
    
    -- Calcular timestamp consolidado com timezone
    v_sched_time := public.combine_date_time_tz(NEW.due_date::text, v_due_time);
    
    IF v_sched_time IS NOT NULL THEN
      -- Remover agendamentos pendentes antigos para recalcular
      DELETE FROM public.notification_queue 
      WHERE entity_type = 'task' AND entity_id = NEW.id::text AND status = 'pending';

      -- 1. Notificação na Hora Exata
      v_key := 'task_due_' || NEW.id::text || '_' || NEW.due_date::text || '_' || COALESCE(v_due_time, '0900') || '_ontime';
      INSERT INTO public.notification_queue (
        event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key
      ) VALUES (
        'TASK_DUE', 'task', NEW.id::text, NEW.user_id, 'Tarefa Vencendo Agora ⏰',
        '"' || NEW.title || '" vence agora no MyFlowDay.',
        to_jsonb(NEW), v_sched_time, 'high', v_key
      ) ON CONFLICT (idempotency_key) DO UPDATE
      SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = now();

      -- 2. Notificação 15 Minutos Antes (se no futuro)
      IF (v_sched_time - INTERVAL '15 minutes' > now()) THEN
        v_key := 'task_due_' || NEW.id::text || '_' || NEW.due_date::text || '_' || COALESCE(v_due_time, '0900') || '_15min';
        INSERT INTO public.notification_queue (
          event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key
        ) VALUES (
          'TASK_DUE', 'task', NEW.id::text, NEW.user_id, '⏰ Tarefa em 15 minutos',
          '"' || NEW.title || '" vence em breve no MyFlowDay.',
          to_jsonb(NEW), v_sched_time - INTERVAL '15 minutes', 'normal', v_key
        ) ON CONFLICT (idempotency_key) DO UPDATE
        SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = now();
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Limpar TODOS os triggers legados de notificação para evitar duplicação
DROP TRIGGER IF EXISTS trg_tasks_unified_eda ON public.tasks;
DROP TRIGGER IF EXISTS trg_tasks_production_e2e ON public.tasks;
DROP TRIGGER IF EXISTS trg_tasks_eda ON public.tasks;
DROP TRIGGER IF EXISTS trg_tasks_enterprise_eda ON public.tasks;
DROP TRIGGER IF EXISTS trg_tasks_event_publisher ON public.tasks;
DROP TRIGGER IF EXISTS trg_task_notifications ON public.tasks;
DROP TRIGGER IF EXISTS task_notifications_trigger ON public.tasks;
DROP TRIGGER IF EXISTS task_events_trigger ON public.tasks;

-- Vincular a ÚNICA trigger canônica à tabela tasks
CREATE TRIGGER trg_tasks_unified_eda
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_tasks_unified_eda_func();


-- 4. IMPLEMENTAÇÃO DO GATILHO DE OBJETIVOS (GOALS)
CREATE OR REPLACE FUNCTION public.trg_goals_unified_eda_func()
RETURNS TRIGGER AS $$
DECLARE
  v_meta jsonb;
  v_start_time text;
  v_sched_time TIMESTAMPTZ;
  v_key text;
BEGIN
  -- Operação de DELEÇÃO (DELETE)
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notification_queue 
    WHERE entity_type = 'goal' AND entity_id = OLD.id::text AND status = 'pending';
    RETURN OLD;
  END IF;

  -- Operação de ATUALIZAÇÃO (UPDATE)
  IF (TG_OP = 'UPDATE') THEN
    IF (NEW.status = 'completed' OR NEW.status = 'canceled' OR NEW.target_date IS NULL OR NEW.target_date = '') THEN
      DELETE FROM public.notification_queue 
      WHERE entity_type = 'goal' AND entity_id = NEW.id::text AND status = 'pending';
    END IF;
  END IF;

  -- Se possui prazo válido e não está finalizado, agenda notificações
  IF (NEW.target_date IS NOT NULL AND NEW.target_date <> '' AND (NEW.status = 'active')) THEN
    -- Extrair horário de início da descrição metadata
    v_meta := public.parse_metadata(NEW.description);
    v_start_time := COALESCE(NEW.start_time, v_meta->>'start_time');

    -- Calcular timestamp consolidado com timezone
    v_sched_time := public.combine_date_time_tz(NEW.target_date::text, v_start_time);

    IF v_sched_time IS NOT NULL THEN
      -- Remover pendências antigas antes de recalcular
      DELETE FROM public.notification_queue 
      WHERE entity_type = 'goal' AND entity_id = NEW.id::text AND status = 'pending';

      -- 1. Notificação na Hora Exata
      v_key := 'goal_due_' || NEW.id::text || '_' || NEW.target_date::text || '_' || COALESCE(v_start_time, '0900') || '_ontime';
      INSERT INTO public.notification_queue (
        event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key
      ) VALUES (
        'GOAL_DUE', 'goal', NEW.id::text, NEW.user_id, 'Objetivo Vencendo Hoje 🎯',
        'Seu objetivo "' || NEW.title || '" vence hoje no MyFlowDay.',
        to_jsonb(NEW), v_sched_time, 'high', v_key
      ) ON CONFLICT (idempotency_key) DO UPDATE
      SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vincular a trigger canônica à tabela goals
DROP TRIGGER IF EXISTS trg_goals_unified_eda ON public.goals;
CREATE TRIGGER trg_goals_unified_eda
  AFTER INSERT OR UPDATE OR DELETE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.trg_goals_unified_eda_func();
