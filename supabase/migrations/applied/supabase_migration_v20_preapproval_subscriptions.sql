-- ====================================================================
-- MIGRATION V20 — MYFLOWDAY PREAPPROVAL SUBSCRIPTIONS
-- Migração do modelo de pagamentos avulsos para assinaturas
-- recorrentes via Mercado Pago Preapproval API.
-- ====================================================================
-- Execute este arquivo no Supabase: Dashboard → SQL Editor → New query
-- Pode ser executado com segurança em bancos existentes (IF NOT EXISTS / IF EXISTS).
-- ====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. ATUALIZAR TABELA subscriptions
-- Adiciona colunas necessárias para o fluxo de assinaturas recorrentes.
-- Colunas do fluxo legado são preservadas.
-- ─────────────────────────────────────────────────────────────────────

-- Identificador da assinatura no Mercado Pago (preapproval id)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;

-- Data da próxima cobrança automática
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ;

-- Valor da assinatura
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 14.90;

-- ID do pagador no Mercado Pago
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payer_id TEXT;

-- Timestamp do último webhook processado
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;

-- Data do último pagamento recorrente aprovado
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ;

-- Payload completo do último webhook (para debug e auditoria)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS webhook_payload JSONB DEFAULT '{}'::jsonb;

-- Garante que current_period_start e current_period_end existem (v16)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Garante que last_payment_id existe (v16)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS last_payment_id TEXT;

-- Garante que provider existe (v16)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'mercado_pago';

-- Garante que metadata existe (v16)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;


-- ─────────────────────────────────────────────────────────────────────
-- 2. UNIQUE em asaas_subscription_id (para upsert no webhook)
-- ─────────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────────
-- 3. ÍNDICES em subscriptions
-- ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_subscription_id
  ON public.subscriptions(asaas_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date
  ON public.subscriptions(next_billing_date);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions(user_id);


-- ─────────────────────────────────────────────────────────────────────
-- 4. ATUALIZAR profiles — adicionar status do preapproval
-- O campo assinatura_status precisa aceitar os status do MP.
-- Remove o CHECK constraint antigo e recria com todos os valores.
-- ─────────────────────────────────────────────────────────────────────

-- Remove constraint antigo de assinatura_status (se existir)
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND conname LIKE '%assinatura_status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- Recria com todos os status possíveis
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_assinatura_status_check
  CHECK (assinatura_status IN (
    'free',
    'active',
    'authorized',
    'paused',
    'cancelled',
    'expired',
    'payment_required',
    'pending',
    'past_due'
  ));

-- Garante que a coluna plano aceita os valores corretos
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND conname LIKE '%plano%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plano_check
  CHECK (plano IN ('free', 'premium'));


-- ─────────────────────────────────────────────────────────────────────
-- 5. CRIAR TABELA subscription_logs
-- Registra TODOS os webhooks e eventos do ciclo de vida da assinatura.
-- Inclui eventos desconhecidos para auditoria completa.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscription_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT,                     -- asaas_subscription_id
  event_type     TEXT NOT NULL,             -- ex: payment_approved
  payload        JSONB DEFAULT '{}'::jsonb, -- payload completo do evento
  created_at     TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.subscription_logs
  IS 'Log de auditoria de todos os eventos de assinatura recorrente (webhook + engine)';

COMMENT ON COLUMN public.subscription_logs.subscription_id
  IS 'ID da assinatura no Asaas.';

COMMENT ON COLUMN public.subscription_logs.event_type
  IS 'Tipo do evento: preapproval.authorized, preapproval.paused, payment.approved, etc.';


-- ─────────────────────────────────────────────────────────────────────
-- 6. RLS em subscription_logs
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.subscription_logs ENABLE ROW LEVEL SECURITY;

-- Admins podem ler todos os logs
DROP POLICY IF EXISTS "Allow admins to read all subscription_logs" ON public.subscription_logs;
CREATE POLICY "Allow admins to read all subscription_logs"
  ON public.subscription_logs FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email' = 'admin@flowday.app') OR
    (auth.jwt() ->> 'email' = 'rafaelle@flowday.app') OR
    (auth.jwt() ->> 'email' = 'rafox@flowday.app')
  );

-- Service role (backend) tem acesso total — bypass via service key
-- Não é necessário criar policy para service_role pois ele bypassa RLS por padrão.


-- ─────────────────────────────────────────────────────────────────────
-- 7. ÍNDICES em subscription_logs
-- ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_subscription_logs_subscription_id
  ON public.subscription_logs(subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_logs_event_type
  ON public.subscription_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_subscription_logs_created_at
  ON public.subscription_logs(created_at DESC);


-- ─────────────────────────────────────────────────────────────────────
-- 8. ATUALIZAR RLS de subscriptions
-- Garante que o service_role (backend) pode fazer upsert via webhook.
-- ─────────────────────────────────────────────────────────────────────

-- Usuário autenticado pode ler a própria assinatura
DROP POLICY IF EXISTS "Allow users to read own subscription" ON public.subscriptions;
CREATE POLICY "Allow users to read own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Usuário autenticado pode inserir a própria assinatura
DROP POLICY IF EXISTS "Allow users to insert own subscription" ON public.subscriptions;
CREATE POLICY "Allow users to insert own subscription"
  ON public.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Usuário autenticado pode atualizar a própria assinatura
DROP POLICY IF EXISTS "Allow users to update own subscription" ON public.subscriptions;
CREATE POLICY "Allow users to update own subscription"
  ON public.subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins podem ler todas as assinaturas
DROP POLICY IF EXISTS "Allow admins to read all subscriptions" ON public.subscriptions;
CREATE POLICY "Allow admins to read all subscriptions"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email' = 'admin@flowday.app') OR
    (auth.jwt() ->> 'email' = 'rafaelle@flowday.app') OR
    (auth.jwt() ->> 'email' = 'rafox@flowday.app')
  );


-- ─────────────────────────────────────────────────────────────────────
-- 9. COMENTÁRIOS DE DOCUMENTAÇÃO EM subscriptions
-- ─────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.subscriptions.asaas_subscription_id
  IS 'ID da assinatura no Asaas';

COMMENT ON COLUMN public.subscriptions.status
  IS 'Status da assinatura: authorized, paused, cancelled, expired, payment_required, pending, past_due, active';

COMMENT ON COLUMN public.subscriptions.next_billing_date
  IS 'Data da próxima cobrança automática (next_payment_date da API do MP)';

COMMENT ON COLUMN public.subscriptions.amount
  IS 'Valor da assinatura mensal em BRL';

COMMENT ON COLUMN public.subscriptions.payer_id
  IS 'ID do pagador no Mercado Pago';

COMMENT ON COLUMN public.subscriptions.last_webhook_at
  IS 'Timestamp do último webhook processado para esta assinatura';

COMMENT ON COLUMN public.subscriptions.last_payment_date
  IS 'Data do último pagamento recorrente aprovado';

COMMENT ON COLUMN public.subscriptions.webhook_payload
  IS 'Payload completo do último webhook recebido (para debug e auditoria)';


-- ─────────────────────────────────────────────────────────────────────
-- 10. RELOAD DO SCHEMA CACHE DO POSTGREST
-- ─────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

-- ====================================================================
-- FIM DA MIGRATION V20
-- ====================================================================
