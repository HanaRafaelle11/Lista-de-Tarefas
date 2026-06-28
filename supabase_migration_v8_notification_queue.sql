-- =======================================================
-- MIGRATION: NOTIFICATION QUEUE & ENGINE (V8)
-- Production Grade Web Push Architecture for 100k+ Users
-- =======================================================

CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL DEFAULT 'task', -- 'task', 'goal', 'habit', 'system'
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT DEFAULT '/',
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed', 'cancelled'
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_error TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Indices de alta performance para varredura ultra-rápida (100k usuários)
CREATE INDEX IF NOT EXISTS idx_notification_queue_dispatch 
  ON public.notification_queue (scheduled_for, status) 
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_notification_queue_user 
  ON public.notification_queue (user_id);

CREATE INDEX IF NOT EXISTS idx_notification_queue_idempotency 
  ON public.notification_queue (idempotency_key);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow users to read own notifications" ON public.notification_queue;
CREATE POLICY "Allow users to read own notifications" 
  ON public.notification_queue FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to insert own notifications" ON public.notification_queue;
CREATE POLICY "Allow users to insert own notifications" 
  ON public.notification_queue FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to update own notifications" ON public.notification_queue;
CREATE POLICY "Allow users to update own notifications" 
  ON public.notification_queue FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to delete own notifications" ON public.notification_queue;
CREATE POLICY "Allow users to delete own notifications" 
  ON public.notification_queue FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.notification_queue IS 'Fila escalável e idenfutável para agendamento e disparo de Web Push notifications';
