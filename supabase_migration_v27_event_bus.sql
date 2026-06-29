-- =======================================================
-- MIGRATION: EVENT-DRIVEN ARCHITECTURE LEVEL 2 EVENT STORE (V27)
-- Internal Event Bus Table for asynchronous, resilient event processing
-- =======================================================

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  idempotency_key TEXT UNIQUE,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(type);
CREATE INDEX IF NOT EXISTS idx_events_created ON public.events(created_at DESC);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to insert events" ON public.events;
CREATE POLICY "Allow authenticated users to insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role full access on events" ON public.events;
CREATE POLICY "Allow service role full access on events" ON public.events FOR ALL TO service_role USING (true);
