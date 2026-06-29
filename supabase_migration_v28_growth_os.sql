-- =======================================================
-- MIGRATION: GROWTH OPERATING SYSTEM (GROWTH OS) ENGINE (V28)
-- Tables for risk profiling, revenue leak detection, automated actions and closed-loop feedback
-- =======================================================

-- 1. User Risk Profile
CREATE TABLE IF NOT EXISTS public.user_risk_profile (
  user_id UUID PRIMARY KEY,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  reason_summary TEXT,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Revenue Leaks
CREATE TABLE IF NOT EXISTS public.revenue_leaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  leak_type TEXT NOT NULL,
  estimated_value_loss NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Growth Actions
CREATE TABLE IF NOT EXISTS public.growth_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  triggered_by_event TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Growth Action Results (Closed-Loop Requirement)
CREATE TABLE IF NOT EXISTS public.growth_action_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.growth_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_returned BOOLEAN NOT NULL DEFAULT false,
  payment_recovered BOOLEAN NOT NULL DEFAULT false,
  engagement_increased BOOLEAN NOT NULL DEFAULT false,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for scaling and fast analytics querying
CREATE INDEX IF NOT EXISTS idx_user_risk_level ON public.user_risk_profile(risk_level);
CREATE INDEX IF NOT EXISTS idx_revenue_leaks_user ON public.revenue_leaks(user_id);
CREATE INDEX IF NOT EXISTS idx_growth_actions_status ON public.growth_actions(status);
CREATE INDEX IF NOT EXISTS idx_growth_action_results_action ON public.growth_action_results(action_id);

-- RLS Policies
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
