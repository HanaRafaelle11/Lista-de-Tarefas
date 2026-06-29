-- =======================================================
-- MIGRATION: EVENT BUS ARCHITECTURE (V14)
-- Event-Driven Architecture with Idempotency & Observability
-- =======================================================

-- 1. TABELA PRINCIPAL DE EVENTOS (EVENT PRODUCER LOG)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL, -- 'task', 'habit', 'goal', 'subscription', 'user'
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,     -- 'TaskCreated', 'TaskUpdated', 'TaskCompleted', 'TaskDeleted', etc.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  trace_id UUID DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'postgres_trigger'
);

-- ÍNDICES DE ALTA PERFORMANCE PARA O EVENT BUS
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_aggregate_type ON public.events(aggregate_type);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_dispatch ON public.events(status, created_at) WHERE status IN ('pending', 'failed');

-- HABILITAR RLS NA TABELA EVENTS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read own events" ON public.events;
CREATE POLICY "Allow users to read own events" 
  ON public.events FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- 2. TABELA DE AUDITORIA E LOGS DE HANDLERS (EVENT_LOGS)
CREATE TABLE IF NOT EXISTS public.event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  handler TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL, -- 'success', 'failed', 'retry'
  execution_time INT,   -- milissegundos
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_event_id ON public.event_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_handler ON public.event_logs(handler);

ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read own event_logs" ON public.event_logs;
CREATE POLICY "Allow users to read own event_logs" 
  ON public.event_logs FOR SELECT 
  TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_logs.event_id AND e.user_id = auth.uid()));

-- 3. TABELA DE MENSAGENS MORTAS (DEAD_LETTER_EVENTS)
CREATE TABLE IF NOT EXISTS public.dead_letter_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  aggregate_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  user_id UUID NOT NULL,
  payload JSONB NOT NULL,
  handler TEXT,
  error TEXT,
  tentativas INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_user ON public.dead_letter_events(user_id);

ALTER TABLE public.dead_letter_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read own dead_letter_events" ON public.dead_letter_events;
CREATE POLICY "Allow users to read own dead_letter_events" 
  ON public.dead_letter_events FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- 4. FUNÇÕES TRIGGERS DE PUBLICAÇÃO DE EVENTOS (EVENT PRODUCERS)

-- 4.1 Trigger Producer para Tasks
CREATE OR REPLACE FUNCTION public.publish_task_event()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_payload JSONB;
  v_user_id UUID;
  v_task_id TEXT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_event_type := 'TaskDeleted';
    v_user_id := OLD.user_id;
    v_task_id := OLD.id::text;
    v_payload := to_jsonb(OLD);
  ELSIF (TG_OP = 'INSERT') THEN
    v_event_type := 'TaskCreated';
    v_user_id := NEW.user_id;
    v_task_id := NEW.id::text;
    v_payload := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_user_id := NEW.user_id;
    v_task_id := NEW.id::text;
    v_payload := to_jsonb(NEW);
    
    IF (OLD.completed IS NOT TRUE AND NEW.completed IS TRUE) THEN
      v_event_type := 'TaskCompleted';
    ELSE
      v_event_type := 'TaskUpdated';
    END IF;
  END IF;

  INSERT INTO public.events (
    aggregate_type,
    aggregate_id,
    event_type,
    user_id,
    payload,
    status,
    source
  ) VALUES (
    'task',
    v_task_id,
    v_event_type,
    v_user_id,
    v_payload,
    'pending',
    'postgres_trigger'
  );

  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tasks_event_publisher ON public.tasks;
CREATE TRIGGER trg_tasks_event_publisher
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.publish_task_event();

COMMENT ON FUNCTION public.publish_task_event IS 'Produtor autônomo de eventos da tabela tasks para a camada Event Bus';
