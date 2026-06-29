-- =========================================================
-- MIGRATION V24: FINAL PRODUCTION FINANCIAL SCHEMAS & IDEMPOTENCY
-- =========================================================

-- 1. TABELA WEBHOOK EVENTS (REGISTRO E RASTREIO DE NOTIFICAÇÕES)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'processed',
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GARANTIR COLUNAS CASO A TABELA TENHA SIDO CRIADA ANTERIORMENTE EM OUTRA VERSÃO
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'processed';
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2. GARANTIR IDEMPOTÊNCIA REAL NO BANCO (Constraint Física Imutável)
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_resource_id ON public.webhook_events(resource_id);

-- 3. TABELA BILLING EVENTS (AUDITORIA DE COBRANÇAS E EVENTOS DE DINHEIRO)
CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payment_id TEXT,
  subscription_id TEXT,
  value NUMERIC DEFAULT 0,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA BILLING LEDGER (FONTE DA VERDADE FINANCEIRA)
CREATE TABLE IF NOT EXISTS public.billing_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  balance_change NUMERIC NOT NULL,
  reason TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
