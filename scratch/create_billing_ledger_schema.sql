-- ====================================================================
-- ARCHITECTURAL BLUEPRINT: LEDGER IMMUTABLE EVENT STORE (billing_ledger)
-- Verdade Absoluta do Sistema (Append-Only Event Store)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.billing_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- payment.created, payment.confirmed, subscription.activated, etc.
    payload JSONB DEFAULT '{}'::jsonb,
    source VARCHAR(50) DEFAULT 'webhook', -- webhook | system | reconciliation
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Índices de alta performance para auditoria e timeline
CREATE INDEX IF NOT EXISTS idx_billing_ledger_user_id ON public.billing_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_event_type ON public.billing_ledger(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_created_at ON public.billing_ledger(created_at DESC);

-- Security RLS
ALTER TABLE public.billing_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service_role full access to billing_ledger"
    ON public.billing_ledger
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
