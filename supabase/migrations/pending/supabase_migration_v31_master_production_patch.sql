-- ====================================================================
-- MIGRATION CONSOLIDADA DE PRODUÇÃO (V31 MASTER PATCH - FINAL VERIFIED)
-- Especificação: Principal Database Engineer (PostgreSQL & Supabase)
-- Finalidade: Criação de infraestrutura, hardening de RLS e otimização de índices
-- Executar no SQL Editor do Supabase Dashboard
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. TABELA DE FEEDBACK DOS USUÁRIOS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.feedback FROM anon, public;
GRANT INSERT ON public.feedback TO anon, authenticated;
GRANT SELECT ON public.feedback TO authenticated;

DROP POLICY IF EXISTS "Allow anyone to insert feedback" ON public.feedback;
CREATE POLICY "Allow anyone to insert feedback" 
  ON public.feedback FOR INSERT 
  TO authenticated, anon 
  WITH CHECK (
    (auth.role() = 'anon' AND user_id IS NULL) OR 
    (auth.role() = 'authenticated' AND (user_id IS NULL OR user_id::text = auth.uid()::text))
  );

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

-- --------------------------------------------------------------------
-- 2. INFRAESTRUTURA DE FATURAMENTO, CONCORRÊNCIA E IDEMPOTÊNCIA
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_idempotency (
  key TEXT PRIMARY KEY,
  id TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  response JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_billing_idempotency_updated ON public.billing_idempotency(updated_at DESC);
ALTER TABLE public.billing_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_idempotency FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_idempotency FROM anon, authenticated, public;

CREATE TABLE IF NOT EXISTS public.billing_locks (
  key TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_billing_locks_expires ON public.billing_locks(expires_at);
ALTER TABLE public.billing_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_locks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_locks FROM anon, authenticated, public;

CREATE TABLE IF NOT EXISTS public.billing_traces (
  trace_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  state_before TEXT,
  state_after TEXT,
  source TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_billing_traces_user ON public.billing_traces(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_traces_payment ON public.billing_traces(payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_traces_timestamp ON public.billing_traces(timestamp DESC);
ALTER TABLE public.billing_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_traces FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_traces FROM anon, authenticated, public;

CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id TEXT,
  payment_id TEXT,
  customer_id TEXT,
  gateway TEXT DEFAULT 'asaas' NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  event TEXT NOT NULL DEFAULT 'payment_received',
  request JSONB,
  response JSONB,
  payload JSONB,
  error TEXT,
  processing_time INTEGER,
  processed BOOLEAN DEFAULT false NOT NULL,
  source TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON public.payment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON public.payment_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_timestamp ON public.payment_events(timestamp DESC);
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_events FROM anon, authenticated, public;

-- --------------------------------------------------------------------
-- 3. INFRAESTRUTURA DO GROWTH OS & RETENÇÃO
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_risk_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  reason_summary TEXT,
  last_calculated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_risk_level ON public.user_risk_profile(risk_level);
ALTER TABLE public.user_risk_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_risk_profile FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_risk_profile FROM anon, authenticated, public;

CREATE TABLE IF NOT EXISTS public.revenue_leaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leak_type TEXT NOT NULL,
  estimated_value_loss NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
  severity TEXT DEFAULT 'medium' NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  detected_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_revenue_leaks_user ON public.revenue_leaks(user_id);
ALTER TABLE public.revenue_leaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_leaks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.revenue_leaks FROM anon, authenticated, public;

CREATE TABLE IF NOT EXISTS public.growth_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  triggered_by_event TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'executed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_growth_actions_user ON public.growth_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_growth_actions_status ON public.growth_actions(status);
ALTER TABLE public.growth_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_actions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.growth_actions FROM anon, authenticated, public;

CREATE TABLE IF NOT EXISTS public.growth_action_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.growth_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_returned BOOLEAN DEFAULT false NOT NULL,
  payment_recovered BOOLEAN DEFAULT false NOT NULL,
  engagement_increased BOOLEAN DEFAULT false NOT NULL,
  evaluated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_growth_action_results_action ON public.growth_action_results(action_id);
CREATE INDEX IF NOT EXISTS idx_growth_action_results_user ON public.growth_action_results(user_id);
ALTER TABLE public.growth_action_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_action_results FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.growth_action_results FROM anon, authenticated, public;

-- --------------------------------------------------------------------
-- 4. HARDENING DE RLS & PRIVILÉGIOS EM TABELAS EXISTENTES (WITH FULL DML PERMISSIONS)
-- --------------------------------------------------------------------
-- Tabela events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.events FROM anon;
GRANT SELECT, INSERT ON public.events TO authenticated;

DROP POLICY IF EXISTS "Allow authenticated read own events" ON public.events;
CREATE POLICY "Allow authenticated read own events" ON public.events FOR SELECT TO authenticated USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Allow authenticated insert own events" ON public.events;
CREATE POLICY "Allow authenticated insert own events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id::text);

-- Tabela billing_ledger
ALTER TABLE public.billing_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_ledger FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_ledger FROM anon;
GRANT SELECT ON public.billing_ledger TO authenticated;

DROP POLICY IF EXISTS "Allow authenticated read own billing ledger" ON public.billing_ledger;
CREATE POLICY "Allow authenticated read own billing ledger" ON public.billing_ledger FOR SELECT TO authenticated USING (auth.uid()::text = user_id::text);

-- Tabela notification_queue (CONCEDE SELECT, INSERT, UPDATE, DELETE PARA AUTHENTICATED)
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_queue FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_queue TO authenticated;

DROP POLICY IF EXISTS "Allow authenticated read own notifications" ON public.notification_queue;
CREATE POLICY "Allow authenticated read own notifications" ON public.notification_queue FOR SELECT TO authenticated USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Allow authenticated insert own notifications" ON public.notification_queue;
CREATE POLICY "Allow authenticated insert own notifications" ON public.notification_queue FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Allow authenticated update own notifications" ON public.notification_queue;
CREATE POLICY "Allow authenticated update own notifications" ON public.notification_queue FOR UPDATE TO authenticated USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Allow authenticated delete own notifications" ON public.notification_queue;
CREATE POLICY "Allow authenticated delete own notifications" ON public.notification_queue FOR DELETE TO authenticated USING (auth.uid()::text = user_id::text);

-- Tabela schema_migrations
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_migrations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.schema_migrations FROM anon, authenticated, public;

-- --------------------------------------------------------------------
-- 5. HARDENING DE FUNÇÕES (SECURITY DEFINER & MUTABLE SEARCH_PATH)
-- --------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE proname = 'get_admin_dashboard_metrics' AND nspname = 'public') THEN
    ALTER FUNCTION public.get_admin_dashboard_metrics() SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() FROM public, anon;
    GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE proname = 'get_user_detail_metrics' AND nspname = 'public') THEN
    ALTER FUNCTION public.get_user_detail_metrics(uuid) SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.get_user_detail_metrics(uuid) FROM public, anon;
    GRANT EXECUTE ON FUNCTION public.get_user_detail_metrics(uuid) TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE proname = 'get_admin_users_list' AND nspname = 'public') THEN
    ALTER FUNCTION public.get_admin_users_list() SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.get_admin_users_list() FROM public, anon;
    GRANT EXECUTE ON FUNCTION public.get_admin_users_list() TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE proname = 'refresh_analytics_materialized_views' AND nspname = 'public') THEN
    ALTER FUNCTION public.refresh_analytics_materialized_views() SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.refresh_analytics_materialized_views() FROM public, anon;
  END IF;
END $$;

COMMIT;

-- Recarga do cache do PostgREST
NOTIFY pgrst, 'reload schema';
