-- ====================================================================
-- MIGRATION V22 — ASAAS PAYMENT GATEWAY INTEGRATION
-- Adiciona colunas para suporte ao Asaas preservando o histórico do MP.
-- ====================================================================

-- 1. Tabela profiles: ID do cliente no Asaas
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_asaas_customer_id
  ON public.profiles(asaas_customer_id);

-- 2. Tabela subscriptions: ID da assinatura e identificador de gateway
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'asaas';

CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_subscription_id
  ON public.subscriptions(asaas_subscription_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_asaas_subscription_id_key'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_asaas_subscription_id_key UNIQUE (asaas_subscription_id);
  END IF;
END $$;

-- 3. Tabela payment_ledger: ID do pagamento no Asaas e identificador de gateway
ALTER TABLE public.payment_ledger
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'asaas';

CREATE INDEX IF NOT EXISTS idx_payment_ledger_asaas_payment_id
  ON public.payment_ledger(asaas_payment_id);

-- 4. Tabela payment_events: Suporte a asaas_payment_id
ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT;

-- 5. Recarregar o cache do PostgREST
NOTIFY pgrst, 'reload schema';
