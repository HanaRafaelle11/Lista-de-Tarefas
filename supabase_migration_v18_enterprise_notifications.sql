-- =======================================================
-- MIGRATION: ENTERPRISE NOTIFICATION INFRASTRUCTURE (V18)
-- 17 Enterprise Modules: Multi-Reminders, Grouping, Quiet Hours, UTC Timezones & In-App Center
-- =======================================================

-- 1. TABELA DE CONFIGURAÇÕES DE NOTIFICAÇÃO DO USUÁRIO (TIMEZONE & QUIET HOURS)
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME NOT NULL DEFAULT '22:30:00',
  quiet_hours_end TIME NOT NULL DEFAULT '07:00:00',
  default_reminders JSONB NOT NULL DEFAULT '["on_time", "15min"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to manage own notification_settings" ON public.user_notification_settings;
CREATE POLICY "Allow users to manage own notification_settings" ON public.user_notification_settings FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 2. TABELA DE NOTIFICAÇÕES IN-APP (CENTRO DE NOTIFICAÇÕES INTERNO)
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_queue_id UUID,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_in_app_user_read ON public.in_app_notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_in_app_created ON public.in_app_notifications(created_at DESC);

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to manage own in_app_notifications" ON public.in_app_notifications;
CREATE POLICY "Allow users to manage own in_app_notifications" ON public.in_app_notifications FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 3. TABELA DE TELEMETRIA E ANALYTICS DE NOTIFICAÇÕES (PREPARADO PARA IA FUTURA)
CREATE TABLE IF NOT EXISTS public.notification_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID,
  event TEXT NOT NULL, -- 'created', 'scheduled', 'sent', 'delivered', 'clicked', 'dismissed', 'snoozed', 'completed', 'failed', 'retry'
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_analytics_user ON public.notification_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_analytics_event ON public.notification_analytics(event);

ALTER TABLE public.notification_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to read own notification_analytics" ON public.notification_analytics;
CREATE POLICY "Allow users to read own notification_analytics" ON public.notification_analytics FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4. TRIGGER ENTERPRISE PARA TAREFAS (MULTI-LEMBRETE & UTC)
CREATE OR REPLACE FUNCTION public.trg_tasks_enterprise_eda_func()
RETURNS TRIGGER AS $$
DECLARE
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

  -- UPDATE TASK
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.notification_queue
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE entity_type = 'task' AND entity_id = NEW.id::text AND status = 'pending';
  END IF;

  -- INSERT OU UPDATE COM DUE_DATE E NÃO CONCLUÍDA
  IF (NEW.due_date IS NOT NULL AND (NEW.completed IS NOT TRUE)) THEN
    
    -- Lembrete 1: Na Hora (on_time)
    v_key := 'task_due_' || NEW.id::text || '_' || NEW.due_date::text || '_ontime';
    INSERT INTO public.notification_queue (
      event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key
    ) VALUES (
      'TASK_DUE', 'task', NEW.id::text, NEW.user_id, NEW.title, 
      COALESCE(NEW.description, 'Sua tarefa vence agora no MyFlowDay.'),
      to_jsonb(NEW), NEW.due_date::TIMESTAMPTZ, 'high', v_key
    ) ON CONFLICT (idempotency_key) DO UPDATE
    SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = now();

    -- Lembrete 2: 15 Minutos Antes (15min)
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

    -- Lembrete 3: 1 Hora Antes (1h)
    v_sched_time := NEW.due_date::TIMESTAMPTZ - INTERVAL '1 hour';
    IF (v_sched_time > now()) THEN
      v_key := 'task_due_' || NEW.id::text || '_' || NEW.due_date::text || '_1h';
      INSERT INTO public.notification_queue (
        event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key
      ) VALUES (
        'TASK_DUE', 'task', NEW.id::text, NEW.user_id, '📅 Lembrete: Tarefa em 1 hora', 
        'Prepare-se para "' || NEW.title || '".',
        to_jsonb(NEW), v_sched_time, 'low', v_key
      ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tasks_eda ON public.tasks;
CREATE TRIGGER trg_tasks_eda
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_tasks_enterprise_eda_func();

COMMENT ON FUNCTION public.trg_tasks_enterprise_eda_func IS 'Motor Enterprise EDA com suporte nativo a Multi-Lembretes e conversão UTC no Postgres';
