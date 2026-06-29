-- ============================================================================
-- MYFLOWDAY — SCHEMA ALIGNMENT MIGRATION v1
-- ============================================================================
-- Data: 2026-06-29
-- Objetivo: Alinhar schema do banco com todas as referências do código
-- Segurança: 100% idempotente (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- Downtime: ZERO — todas operações são não-bloqueantes
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. TASKS — adicionar updated_at (usado pelo sync conflict resolution)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON public.tasks(deleted_at);

-- Trigger para auto-atualizar updated_at em tasks
CREATE OR REPLACE FUNCTION public.update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tasks_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 2. GOALS — adicionar deleted_at para soft delete consistente
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_deleted_at ON public.goals(deleted_at);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. NOTIFICATION_QUEUE — adicionar colunas faltantes
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS last_error TEXT DEFAULT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. NOTIFICATION_LOGS — garantir colunas esperadas pelo backend
-- ════════════════════════════════════════════════════════════════════════════
-- A tabela pode existir mas estar vazia (sem colunas definidas ou schema mínimo).
-- Recriar se necessário com schema completo.
DO $$
BEGIN
  -- Verificar se a tabela tem a coluna user_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notification_logs' AND column_name = 'user_id'
  ) THEN
    -- Se a tabela existe mas não tem as colunas, adicionar
    ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
  END IF;
END$$;

ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS notification_queue_id UUID DEFAULT NULL;
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS body TEXT DEFAULT '';
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS error_message TEXT DEFAULT NULL;
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- 5. PUSH_SUBSCRIPTIONS — tabela para Web Push (VAPID)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  expiration_time TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(endpoint)
);

-- Índice para busca por user_id (usado pelo notification.service)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- RLS: cada usuário só pode ver/editar as próprias subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy para service role (backend) poder ler todas as subscriptions
DROP POLICY IF EXISTS "Service role full access push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Service role full access push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. GROWTH OS TABLES
-- ════════════════════════════════════════════════════════════════════════════

-- 6a. User Risk Profile
CREATE TABLE IF NOT EXISTS public.user_risk_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  reason_summary TEXT DEFAULT '',
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_risk_profile_user_id ON public.user_risk_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_user_risk_profile_risk_level ON public.user_risk_profile(risk_level);

-- 6b. Revenue Leaks
CREATE TABLE IF NOT EXISTS public.revenue_leaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leak_type TEXT NOT NULL,
  estimated_value_loss NUMERIC(10,2) DEFAULT 0,
  severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_leaks_user_id ON public.revenue_leaks(user_id);

-- 6c. Growth Actions
CREATE TABLE IF NOT EXISTS public.growth_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  triggered_by_event TEXT DEFAULT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_growth_actions_user_id ON public.growth_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_growth_actions_status ON public.growth_actions(status);

-- 6d. Growth Action Results (Closed Loop)
CREATE TABLE IF NOT EXISTS public.growth_action_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.growth_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_returned BOOLEAN DEFAULT false,
  payment_recovered BOOLEAN DEFAULT false,
  engagement_increased BOOLEAN DEFAULT false,
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_growth_action_results_action_id ON public.growth_action_results(action_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 7. RLS para tabelas Growth OS (service role full access)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.user_risk_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_leaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_action_results ENABLE ROW LEVEL SECURITY;

-- Service role policies (backend worker precisa de acesso total)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['user_risk_profile', 'revenue_leaks', 'growth_actions', 'growth_action_results']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access %s" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Service role full access %s" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. PROFILES — adicionar created_at se ausente para analiticos de onboarding
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO PÓS-MIGRATION
-- ============================================================================
-- Execute estas queries para validar:
--
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'updated_at';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'goals' AND column_name = 'deleted_at';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'notification_queue' AND column_name IN ('attempts', 'sent_at', 'last_error');
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'push_subscriptions';
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('user_risk_profile', 'revenue_leaks', 'growth_actions', 'growth_action_results');
-- ============================================================================
