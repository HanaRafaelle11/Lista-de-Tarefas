-- ====================================================================
-- MIGRATION: TRUTH AUDIT FINAL FIX (V29)
-- Consolidação de todas as tabelas e políticas ausentes para liberação de produção
-- Executar este script no SQL Editor do Supabase Dashboard
-- ====================================================================

-- 1. Tabela de Feedback dos Usuários
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anyone to insert feedback" ON public.feedback;
CREATE POLICY "Allow anyone to insert feedback" 
  ON public.feedback FOR INSERT 
  TO authenticated, anon 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admins to read all feedback" ON public.feedback;
CREATE POLICY "Allow admins to read all feedback" 
  ON public.feedback FOR SELECT 
  TO authenticated 
  USING (
    (auth.jwt()->>'email' = 'admin@flowday.app') OR 
    (auth.jwt()->>'email' = 'rafaelle@flowday.app') OR 
    (auth.jwt()->>'email' = 'rafox@flowday.app') OR
    (auth.jwt()->>'email' = 'hanarafaelle11@gmail.com')
  );

-- 2. Infraestrutura de Faturamento, Travas e Idempotência
CREATE TABLE IF NOT EXISTS public.billing_idempotency (
  key TEXT PRIMARY KEY,
  id TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  response JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_billing_idempotency_updated ON public.billing_idempotency(updated_at);
ALTER TABLE public.billing_idempotency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.billing_idempotency;
CREATE POLICY service_role_all ON public.billing_idempotency FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS public.billing_locks (
  key TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.billing_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.billing_locks;
CREATE POLICY service_role_all ON public.billing_locks FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS public.billing_traces (
  trace_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  state_before TEXT,
  state_after TEXT,
  source TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_billing_traces_user ON public.billing_traces(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_traces_payment ON public.billing_traces(payment_id);
ALTER TABLE public.billing_traces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.billing_traces;
CREATE POLICY service_role_all ON public.billing_traces FOR ALL TO service_role USING (true);

-- 3. Infraestrutura do Growth OS
CREATE TABLE IF NOT EXISTS public.user_risk_profile (
  user_id UUID PRIMARY KEY,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  reason_summary TEXT,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.revenue_leaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  leak_type TEXT NOT NULL,
  estimated_value_loss NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.growth_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  triggered_by_event TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.growth_action_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.growth_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_returned BOOLEAN NOT NULL DEFAULT false,
  payment_recovered BOOLEAN NOT NULL DEFAULT false,
  engagement_increased BOOLEAN NOT NULL DEFAULT false,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_risk_level ON public.user_risk_profile(risk_level);
CREATE INDEX IF NOT EXISTS idx_revenue_leaks_user ON public.revenue_leaks(user_id);
CREATE INDEX IF NOT EXISTS idx_growth_actions_status ON public.growth_actions(status);
CREATE INDEX IF NOT EXISTS idx_growth_action_results_action ON public.growth_action_results(action_id);

ALTER TABLE public.user_risk_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_leaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_action_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access on user_risk_profile" ON public.user_risk_profile;
CREATE POLICY "Allow service role full access on user_risk_profile" ON public.user_risk_profile FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Allow service role full access on revenue_leaks" ON public.revenue_leaks;
CREATE POLICY "Allow service role full access on revenue_leaks" ON public.revenue_leaks FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Allow service role full access on growth_actions" ON public.growth_actions;
CREATE POLICY "Allow service role full access on growth_actions" ON public.growth_actions FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Allow service role full access on growth_action_results" ON public.growth_action_results;
CREATE POLICY "Allow service role full access on growth_action_results" ON public.growth_action_results FOR ALL TO service_role USING (true);

-- 4. Tabela de Eventos de Observabilidade de Pagamento
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id TEXT,
  payment_id TEXT,
  customer_id TEXT,
  gateway TEXT DEFAULT 'asaas',
  status TEXT NOT NULL DEFAULT 'pending',
  event TEXT NOT NULL DEFAULT 'payment_received',
  request JSONB,
  response JSONB,
  payload JSONB,
  error TEXT,
  processing_time INTEGER,
  processed BOOLEAN DEFAULT false,
  source TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON public.payment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON public.payment_events(payment_id);
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.payment_events;
CREATE POLICY service_role_all ON public.payment_events FOR ALL TO service_role USING (true);

-- 5. Recarga do Cache de Schemas do PostgREST
NOTIFY pgrst, 'reload schema';
