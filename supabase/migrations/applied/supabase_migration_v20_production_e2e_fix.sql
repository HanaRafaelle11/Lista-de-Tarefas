-- =======================================================
-- MIGRATION: PRODUCTION END-TO-END NOTIFICATION & TASK FIX (V20)
-- Guaranteed single trigger, notification_logs feeding & offset calculation
-- =======================================================

-- 1. GARANTIR ESTRUTURA DA TABELA DE LOGS DE NOTIFICAÇÃO (NOTIFICATION_LOGS)
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_queue_id UUID,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_logs_user ON public.notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_created ON public.notification_logs(created_at DESC);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to read own notification_logs" ON public.notification_logs;
CREATE POLICY "Allow users to read own notification_logs" ON public.notification_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. ELIMINAÇÃO DINÂMICA DE TODAS AS TRIGGERS ANTERIORES/LEGADAS NA TABELA TASKS
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'public.tasks'::regclass 
    AND NOT tgisinternal
  ) LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON public.tasks CASCADE;';
  END LOOP;
END $$;

-- 3. CRIAR A ÚNICA FUNÇÃO DE TRIGGER CANÔNICA DE PRODUÇÃO (TRG_TASKS_PRODUCTION_E2E_FUNC)
CREATE OR REPLACE FUNCTION public.trg_tasks_production_e2e_func()
RETURNS TRIGGER AS $$
DECLARE
  v_sched_time TIMESTAMPTZ;
  v_offset_minutes INT := 5; -- Padrao produto: 5 minutos antes
  v_key TEXT;
  v_meta JSONB;
BEGIN
  -- LÓGICA DE DELETE: Cancela agendamentos pendentes associados à tarefa
  IF TG_OP = 'DELETE' THEN
    UPDATE public.notification_queue
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE entity_type = 'task' AND entity_id = OLD.id::text AND status = 'pending';
    RETURN OLD;
  END IF;

  -- LÓGICA DE UPDATE: Cancela agendamentos pendentes anteriores da tarefa
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.notification_queue
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE entity_type = 'task' AND entity_id = NEW.id::text AND status = 'pending';
  END IF;

  -- LÓGICA DE INSERT OU UPDATE: Agenda notificação se tiver due_date e não estiver concluída
  IF (NEW.due_date IS NOT NULL AND (NEW.completed IS NOT TRUE)) THEN
    
    -- Tenta extrair offset da descrição se houver metadados (ou padrão 5 minutos antes)
    BEGIN
      IF NEW.description LIKE '%--flowday-meta--%' THEN
        v_meta := (split_part(NEW.description, '--flowday-meta--', 2))::jsonb;
        IF (v_meta->>'reminder_offset') = '0' OR (v_meta->>'reminder_offset') = 'na_hora' THEN
          v_offset_minutes := 0;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_offset_minutes := 5;
    END;

    -- Calcula scheduled_for aplicando o offset de produto
    v_sched_time := NEW.due_date::TIMESTAMPTZ - (v_offset_minutes || ' minutes')::INTERVAL;
    
    -- Se o horário agendado for no futuro (ou próximo), insere na fila com chave idempotente única
    IF (v_sched_time > now() - INTERVAL '1 minute') THEN
      v_key := 'task_due_' || NEW.id::text || '_' || NEW.due_date::text;
      
      INSERT INTO public.notification_queue (
        event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key, status
      ) VALUES (
        'TASK_DUE', 'task', NEW.id::text, NEW.user_id, NEW.title, 
        COALESCE(NULLIF(split_part(NEW.description, '--flowday-meta--', 1), ''), 'Sua tarefa vence em breve no MyFlowDay.'),
        to_jsonb(NEW), v_sched_time, 'high', v_key, 'pending'
      ) ON CONFLICT (idempotency_key) DO UPDATE
      SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = now();
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. VINCULAR A ÚNICA TRIGGER CANÔNICA À TABELA TASKS (INSERT OR UPDATE OR DELETE)
CREATE TRIGGER trg_tasks_production_e2e
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_tasks_production_e2e_func();

COMMENT ON FUNCTION public.trg_tasks_production_e2e_func IS 'Única trigger canônica atômica de produção para tasks no MyFlowDay';
