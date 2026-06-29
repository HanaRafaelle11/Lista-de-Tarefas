-- =======================================================
-- MIGRATION: EVENT-DRIVEN NOTIFICATION INFRASTRUCTURE (V17)
-- Enterprise-Grade EDA Engine for Tasks, Goals, Habits & Focus Sessions
-- =======================================================

-- 1. TABELA DE SESSÕES DE FOCO / POMODORO
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'focus' CHECK (type IN ('focus', 'short_break', 'long_break')),
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user ON public.focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_status ON public.focus_sessions(status, end_time);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to read own focus_sessions" ON public.focus_sessions;
CREATE POLICY "Allow users to read own focus_sessions" ON public.focus_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. REESTRUTURAÇÃO DA TABELA NOTIFICATION_QUEUE
CREATE TABLE IF NOT EXISTS public.notification_queue_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'task', 'goal', 'habit', 'focus', 'subscription', 'billing', 'system'
  entity_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Copia dados existentes se a tabela antiga existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_queue') THEN
    INSERT INTO public.notification_queue_v2 (
      id, event_type, entity_type, entity_id, user_id, title, body, scheduled_for, status, idempotency_key, created_at, updated_at
    )
    SELECT 
      id, 'TASK_DUE', 'task', task_id::text, user_id, title, COALESCE(body, ''), scheduled_for, status, 
      COALESCE(idempotency_key, 'legacy_' || id::text), COALESCE(created_at, now()), COALESCE(updated_at, now())
    FROM public.notification_queue
    ON CONFLICT (idempotency_key) DO NOTHING;
    
    DROP TABLE public.notification_queue CASCADE;
  END IF;
END $$;

ALTER TABLE public.notification_queue_v2 RENAME TO notification_queue;

-- ÍNDICES DE ALTA PERFORMANCE PARA O ENGINE EDA
CREATE INDEX IF NOT EXISTS idx_notif_queue_dispatch ON public.notification_queue(status, scheduled_for) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_notif_queue_entity ON public.notification_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notif_queue_user ON public.notification_queue(user_id);

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to read own notification_queue" ON public.notification_queue;
CREATE POLICY "Allow users to read own notification_queue" ON public.notification_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. TRIGGERS AUTOMÁTICOS PARA EVENT-DRIVEN ARCHITECTURE

-- 3.1 Trigger Producer para Tasks (com suporte a Multi-Lembretes)
CREATE OR REPLACE FUNCTION public.trg_tasks_eda_func()
RETURNS TRIGGER AS $$
DECLARE
  v_reminders JSONB;
  v_reminder_item TEXT;
  v_offset INTERVAL;
  v_sched_time TIMESTAMPTZ;
  v_key TEXT;
BEGIN
  -- DELETE TASK
  IF TG_OP = 'DELETE' THEN
    UPDATE public.notification_queue
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE entity_type = 'task' AND entity_id = OLD.id::text AND status = 'pending';
    RETURN OLD;
  END IF;

  -- UPDATE TASK (Cancela agendamentos anteriores)
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.notification_queue
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE entity_type = 'task' AND entity_id = NEW.id::text AND status = 'pending';
  END IF;

  -- INSERT OU UPDATE COM DUE_DATE E NÃO CONCLUÍDA
  IF (NEW.due_date IS NOT NULL AND (NEW.completed IS NOT TRUE)) THEN
    -- Extrai array de lembretes da descrição se existir ou usa padrão na hora
    v_reminders := '["on_time"]'::jsonb;
    
    -- Insere notificação principal na hora exata
    v_key := 'task_due_' || NEW.id::text || '_' || NEW.due_date::text || '_ontime';
    INSERT INTO public.notification_queue (
      event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key
    ) VALUES (
      'TASK_DUE', 'task', NEW.id::text, NEW.user_id, NEW.title, 
      COALESCE(NEW.description, 'Sua tarefa vence agora no MyFlowDay.'),
      to_jsonb(NEW), NEW.due_date::TIMESTAMPTZ, 'high', v_key
    ) ON CONFLICT (idempotency_key) DO UPDATE
    SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = now();

    -- Se tiver lembrete antecedente de 15 min por padrão
    v_sched_time := NEW.due_date::TIMESTAMPTZ - INTERVAL '15 minutes';
    IF (v_sched_time > now()) THEN
      v_key := 'task_due_' || NEW.id::text || '_' || NEW.due_date::text || '_15min';
      INSERT INTO public.notification_queue (
        event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key
      ) VALUES (
        'TASK_DUE', 'task', NEW.id::text, NEW.user_id, '⏰ Tarefa em 15 minutos', 
        '"' || NEW.title || '" vence em breve.',
        to_jsonb(NEW), v_sched_time, 'normal', v_key
      ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tasks_eda ON public.tasks;
CREATE TRIGGER trg_tasks_eda
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_tasks_eda_func();

-- 3.2 Trigger Producer para Focus Sessions (Pomodoro Autônomo)
CREATE OR REPLACE FUNCTION public.trg_focus_sessions_eda_func()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_body TEXT;
  v_event_type TEXT;
  v_key TEXT;
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.status != 'active') THEN
    UPDATE public.notification_queue
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE entity_type = 'focus' AND entity_id = OLD.id::text AND status = 'pending';
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  END IF;

  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'active')) THEN
    IF (NEW.type = 'focus') THEN
      v_event_type := 'FOCUS_FINISHED';
      v_title := '🍅 Sessão de Foco Concluída!';
      v_body := 'Parabéns pelo foco absoluto! Hora de fazer uma pausa merecida.';
    ELSE
      v_event_type := 'BREAK_FINISHED';
      v_title := '☕ Hora de Voltar ao Foco!';
      v_body := 'Sua pausa terminou. Vamos iniciar o próximo bloco de produtividade?';
    END IF;

    v_key := 'focus_' || NEW.id::text || '_' || NEW.end_time::text;

    INSERT INTO public.notification_queue (
      event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key
    ) VALUES (
      v_event_type, 'focus', NEW.id::text, NEW.user_id, v_title, v_body,
      to_jsonb(NEW), NEW.end_time::TIMESTAMPTZ, 'urgent', v_key
    ) ON CONFLICT (idempotency_key) DO UPDATE
    SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_focus_sessions_eda ON public.focus_sessions;
CREATE TRIGGER trg_focus_sessions_eda
  AFTER INSERT OR UPDATE OR DELETE ON public.focus_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_focus_sessions_eda_func();

COMMENT ON FUNCTION public.trg_tasks_eda_func IS 'Motor Event-Driven autônomo para gerenciamento de notificações de Tarefas no Postgres';
COMMENT ON FUNCTION public.trg_focus_sessions_eda_func IS 'Motor Event-Driven autônomo para gerenciamento de Pomodoro e Pausas no Postgres';
