-- =======================================================
-- MIGRATION: EXACT PRODUCTION WEB PUSH ARCHITECTURE (V11)
-- 100% Autonomous, Zero React Dependency, Postgres Source of Truth
-- =======================================================

-- 1. CRIAR TABELA DE NOTIFICAÇÕES (FILA DE DISPARO)
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled')),
  type TEXT DEFAULT 'task',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ÍNDICES DE ALTA PERFORMANCE (ESCALA 100K+)
CREATE INDEX IF NOT EXISTS idx_notification_queue_due
ON public.notification_queue(status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_notification_queue_task
ON public.notification_queue(task_id);

-- HABILITAR RLS NA NOTIFICATION QUEUE
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read own notification_queue" ON public.notification_queue;
CREATE POLICY "Allow users to read own notification_queue" 
  ON public.notification_queue FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- 2. TABELA DE OBSERVABILIDADE E AUDITORIA DE ERROS
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID,
  task_id UUID,
  user_id UUID,
  status TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON public.notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON public.notification_logs(created_at DESC);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read own notification_logs" ON public.notification_logs;
CREATE POLICY "Allow users to read own notification_logs" 
  ON public.notification_logs FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- 3. FUNÇÃO PRINCIPAL AUTÔNOMA (TRIGGERS POSTGRES)
CREATE OR REPLACE FUNCTION public.handle_task_notifications()
RETURNS TRIGGER AS $$
BEGIN

  -- DELETE TASK
  IF TG_OP = 'DELETE' THEN
    UPDATE public.notification_queue
    SET status = 'cancelled', updated_at = now()
    WHERE task_id = OLD.id;

    RETURN OLD;
  END IF;

  -- INSERT TASK
  IF TG_OP = 'INSERT' THEN
    IF (NEW.due_date IS NOT NULL) THEN
      INSERT INTO public.notification_queue (
        task_id,
        user_id,
        title,
        body,
        scheduled_for
      )
      VALUES (
        NEW.id,
        NEW.user_id,
        NEW.title,
        NEW.description,
        NEW.due_date
      );
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE TASK
  IF TG_OP = 'UPDATE' THEN

    -- cancela antigos
    UPDATE public.notification_queue
    SET status = 'cancelled', updated_at = now()
    WHERE task_id = NEW.id
    AND status = 'pending';

    -- recria com nova data (se não estivier concluída e tiver data)
    IF (NEW.due_date IS NOT NULL AND (NEW.completed IS NOT TRUE)) THEN
      INSERT INTO public.notification_queue (
        task_id,
        user_id,
        title,
        body,
        scheduled_for
      )
      VALUES (
        NEW.id,
        NEW.user_id,
        NEW.title,
        NEW.description,
        NEW.due_date
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. TRIGGER NA TABELA TASKS
DROP TRIGGER IF EXISTS task_notifications_trigger ON public.tasks;

CREATE TRIGGER task_notifications_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_task_notifications();

COMMENT ON FUNCTION public.handle_task_notifications IS 'Gera e cancela notificações de tarefas no Postgres com 0 dependência do frontend';
