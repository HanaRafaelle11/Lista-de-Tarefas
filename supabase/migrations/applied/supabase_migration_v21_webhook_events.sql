-- ====================================================================
-- MIGRATION V21 — WEBHOOK EVENTS (IDEMPOTÊNCIA)
-- Garante que cada notificação do Mercado Pago seja processada
-- exatamente uma vez, mesmo em caso de reenvio ou replay.
-- ====================================================================
-- Execute no Supabase: Dashboard → SQL Editor → New query
-- Seguro para execução em banco existente (IF NOT EXISTS).
-- ====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. CRIAR TABELA webhook_events
-- Cada linha representa um evento de webhook já processado.
-- event_id é o identificador único da notificação do Mercado Pago.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      TEXT        NOT NULL,       -- ID único da notificação MP (body.id ou fallback composto)
  event_type    TEXT,                       -- ex: preapproval, payment
  resource_id   TEXT,                       -- ex: preapproval.id ou payment.id
  processed_at  TIMESTAMPTZ DEFAULT now(),  -- timestamp do processamento
  payload       JSONB       DEFAULT '{}'::jsonb  -- body completo do webhook para auditoria
);

COMMENT ON TABLE public.webhook_events
  IS 'Registro de idempotência de webhooks do Mercado Pago. Cada evento é processado exatamente uma vez.';

COMMENT ON COLUMN public.webhook_events.event_id
  IS 'ID único da notificação. Usa body.id do MP quando disponível, ou fallback: type_resourceId_action.';


-- ─────────────────────────────────────────────────────────────────────
-- 2. UNIQUE INDEX em event_id (garante idempotência via banco)
-- ─────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_event_id
  ON public.webhook_events(event_id);


-- ─────────────────────────────────────────────────────────────────────
-- 3. ÍNDICES AUXILIARES
-- ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type
  ON public.webhook_events(event_type);

CREATE INDEX IF NOT EXISTS idx_webhook_events_resource_id
  ON public.webhook_events(resource_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
  ON public.webhook_events(processed_at DESC);


-- ─────────────────────────────────────────────────────────────────────
-- 4. RLS em webhook_events
-- Service role bypassa RLS por padrão — sem policy necessária para backend.
-- Admins podem ler via dashboard.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admins to read all webhook_events" ON public.webhook_events;
CREATE POLICY "Allow admins to read all webhook_events"
  ON public.webhook_events FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email' = 'admin@flowday.app') OR
    (auth.jwt() ->> 'email' = 'rafaelle@flowday.app') OR
    (auth.jwt() ->> 'email' = 'rafox@flowday.app')
  );


-- ─────────────────────────────────────────────────────────────────────
-- 5. VERCEL CRON — tabela de controle de execuções (opcional)
-- Registra quando o sync job rodou pela última vez.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cron_runs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name    TEXT        NOT NULL,
  started_at  TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT,       -- 'running' | 'success' | 'error'
  result      JSONB       DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.cron_runs
  IS 'Registro de execuções de cron jobs (ex: subscription-sync).';

CREATE INDEX IF NOT EXISTS idx_cron_runs_job_name
  ON public.cron_runs(job_name);

CREATE INDEX IF NOT EXISTS idx_cron_runs_started_at
  ON public.cron_runs(started_at DESC);

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admins to read all cron_runs" ON public.cron_runs;
CREATE POLICY "Allow admins to read all cron_runs"
  ON public.cron_runs FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email' = 'admin@flowday.app') OR
    (auth.jwt() ->> 'email' = 'rafaelle@flowday.app') OR
    (auth.jwt() ->> 'email' = 'rafox@flowday.app')
  );


-- ─────────────────────────────────────────────────────────────────────
-- 6. RELOAD DO SCHEMA CACHE DO POSTGREST
-- ─────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

-- ====================================================================
-- FIM DA MIGRATION V21
-- ====================================================================
