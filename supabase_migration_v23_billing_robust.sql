-- =========================================================
-- MIGRATION V23: ROBUST BILLING & ASAAS SUBSCRIPTIONS SCHEMA
-- =========================================================

-- 1. Adicionar colunas billing_type e auto_renew em subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'pix',
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_payment_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'asaas';

-- 2. Garantir coluna asaas_customer_id na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- 3. Garantir colunas de rastreio em webhook_events
ALTER TABLE public.webhook_events
ADD COLUMN IF NOT EXISTS event_id TEXT,
ADD COLUMN IF NOT EXISTS event_type TEXT,
ADD COLUMN IF NOT EXISTS resource_id TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS payload JSONB;

-- 4. Criar Índices de Alta Performance para Idempotência e Expiração
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_period ON public.subscriptions(status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_profiles_asaas_customer_id ON public.profiles(asaas_customer_id);
