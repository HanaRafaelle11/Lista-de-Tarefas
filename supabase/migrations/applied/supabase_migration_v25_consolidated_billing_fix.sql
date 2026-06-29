-- =========================================================
-- MIGRATION V25: CONSOLIDATED PRODUCTION BILLING SCHEMAS FIX
-- =========================================================

-- 1. FIX TABLE: subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'pix',
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_payment_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'asaas';

-- 2. FIX TABLE: webhook_events
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'processed',
  user_id TEXT,
  error_log TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.webhook_events 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'processed',
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS error_log TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_resource_id ON public.webhook_events(resource_id);

-- 3. FIX TABLE: billing_events
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

ALTER TABLE public.billing_events
ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'payment_approved';

-- 4. FIX TABLE: billing_ledger
CREATE TABLE IF NOT EXISTS public.billing_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  balance_change NUMERIC NOT NULL,
  reason TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
