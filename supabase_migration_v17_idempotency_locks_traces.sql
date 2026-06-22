-- ====================================================================
-- MIGRATION: PRODUCTION HARDENING LAYER (V17)
-- ====================================================================

-- 1. Idempotency Table
CREATE TABLE IF NOT EXISTS public.billing_idempotency (
  key TEXT PRIMARY KEY,
  status TEXT NOT NULL, -- 'processing', 'completed', 'failed'
  response JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Distributed Locks Table
CREATE TABLE IF NOT EXISTS public.billing_locks (
  key TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Billing Traces Table
CREATE TABLE IF NOT EXISTS public.billing_traces (
  trace_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  state_before TEXT,
  state_after TEXT,
  source TEXT NOT NULL, -- 'webhook', 'cron', 'reconciliation', etc.
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_traces_user ON public.billing_traces(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_traces_payment ON public.billing_traces(payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_idempotency_updated ON public.billing_idempotency(updated_at);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
