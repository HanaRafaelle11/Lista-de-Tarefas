-- ====================================================================
-- MIGRATION: ADD SAAS COLUMNS TO SUBSCRIPTIONS TABLE (V16)
-- ====================================================================

-- Alter subscriptions to add billing cycle and provider columns
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS last_payment_id TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'mercado_pago';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
