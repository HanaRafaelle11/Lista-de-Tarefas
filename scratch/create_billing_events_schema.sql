-- ====================================================================
-- ARCHITECTURAL PILLAR 1: EVENT SOURCING DE BILLING (APPEND-ONLY)
-- Tabela imutável para registrar todos os eventos do ciclo de vida financeiro
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- payment_created, payment_confirmed, subscription_activated, etc.
    gateway VARCHAR(50) DEFAULT 'asaas',
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Índices para consultas ultra-rápidas e auditoria
CREATE INDEX IF NOT EXISTS idx_billing_events_user_id ON public.billing_events(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON public.billing_events(type);
CREATE INDEX IF NOT EXISTS idx_billing_events_created_at ON public.billing_events(created_at DESC);

-- RLS (Row Level Security) - Leitura restrita a administradores/service_role
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service_role full access to billing_events"
    ON public.billing_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
