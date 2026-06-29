-- ====================================================================
-- MIGRATION: CREATE BILLING_IDEMPOTENCY TABLE AND CORRESPONDING INDEX (V19)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.billing_idempotency (
  key TEXT PRIMARY KEY,
  id TEXT,
  status TEXT NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  response JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fast lookup by updated_at
CREATE INDEX IF NOT EXISTS idx_billing_idempotency_updated ON public.billing_idempotency(updated_at);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
