-- =======================================================
-- MIGRATION: POSTGRES TRIGGERS & OBSERVABILITY LOGS (V9)
-- 100% Autonomous Push Notification Infrastructure
-- =======================================================

-- 1. Criar Tabela de Observabilidade e Auditoria de Disparos
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notification_queue(id) ON DELETE SET NULL,
  task_id TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'sent', 'failed', 'retry', 'cleaned', 'cancelled'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON public.notification_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON public.notification_logs (created_at DESC);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read own notification logs" ON public.notification_logs;
CREATE POLICY "Allow users to read own notification logs" 
  ON public.notification_logs FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- 2. Garantir Restrição de Idempotência Única na notification_queue
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notification_queue_idempotency_key_key'
    ) THEN
        ALTER TABLE public.notification_queue ADD CONSTRAINT notification_queue_idempotency_key_key UNIQUE (idempotency_key);
    END IF;
END $$;

-- 3. Função Trigger PL/pgSQL Autônoma para Gerenciamento de Notificações
CREATE OR REPLACE FUNCTION public.handle_task_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_dispatch_time TIMESTAMPTZ;
  v_idempotency_key TEXT;
BEGIN
  -- ── A) OPERAÇÃO DE DELEÇÃO (ON DELETE) ─────────────────
  IF (TG_OP = 'DELETE') THEN
    -- Cancelar agendamentos pendentes associados à tarefa deletada
    UPDATE public.notification_queue
    SET status = 'cancelled'
    WHERE entity_id = OLD.id::text 
      AND status IN ('pending', 'processing');
    RETURN OLD;
  END IF;

  -- ── B) OPERAÇÃO DE ATUALIZAÇÃO (ON UPDATE) ─────────────
  IF (TG_OP = 'UPDATE') THEN
    -- Se a tarefa foi concluída ou o prazo foi removido/alterado, cancela agendamentos anteriores
    IF (NEW.completed = true OR OLD.due_date IS DISTINCT FROM NEW.due_date) THEN
      UPDATE public.notification_queue
      SET status = 'cancelled'
      WHERE entity_id = OLD.id::text 
        AND status IN ('pending', 'processing');
    END IF;
  END IF;

  -- ── C) OPERAÇÃO DE INSERÇÃO / RE-AGENDAMENTO ────────────
  -- Se a tarefa possui prazo e NÃO está concluída, insere o novo agendamento na fila
  IF (NEW.due_date IS NOT NULL AND NEW.due_date <> '' AND (NEW.completed IS NOT TRUE)) THEN
    BEGIN
      -- Tentar converter due_date para TIMESTAMPTZ e calcular 15 minutos antes
      v_dispatch_time := (NEW.due_date::TIMESTAMPTZ) - INTERVAL '15 minutes';
      v_idempotency_key := 'task_due_' || NEW.id::text || '_' || NEW.due_date::text;

      INSERT INTO public.notification_queue (
        user_id,
        entity_type,
        entity_id,
        title,
        body,
        url,
        scheduled_for,
        status,
        idempotency_key
      ) VALUES (
        NEW.user_id,
        'task',
        NEW.id::text,
        'Tarefa Próxima do Vencimento ⏰',
        '"' || NEW.title || '" vence em breve no MyFlowDay.',
        '/tasks',
        v_dispatch_time,
        'pending',
        v_idempotency_key
      )
      ON CONFLICT (idempotency_key) DO UPDATE
      SET scheduled_for = EXCLUDED.scheduled_for,
          status = 'pending';
    EXCEPTION WHEN OTHERS THEN
      -- Evitar que falhas de formatação de data travem a escrita da tarefa
      RAISE WARNING 'Erro ao agendar notificação para tarefa %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Vincular o Trigger à Tabela public.tasks
DROP TRIGGER IF EXISTS trg_task_notifications ON public.tasks;
CREATE TRIGGER trg_task_notifications
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_notifications();

COMMENT ON FUNCTION public.handle_task_notifications IS 'Gera e cancela notificações de tarefas no nível de banco de dados com 0 dependência do frontend';
