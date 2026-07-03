-- 1. Criar tabela user_entitlements
CREATE TABLE IF NOT EXISTS public.user_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_feature UNIQUE(user_id, feature)
);

-- 2. Habilitar RLS
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Allow users to read own entitlements" ON public.user_entitlements;
CREATE POLICY "Allow users to read own entitlements"
ON public.user_entitlements FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

-- 4. Popular a tabela com as assinaturas ativas existentes (lazy reconciliation / seed)
INSERT INTO public.user_entitlements (user_id, feature, status, valid_until)
SELECT user_id, 'pro_features', 'active', current_period_end
FROM public.subscriptions
WHERE status = 'active' AND current_period_end > NOW()
ON CONFLICT (user_id, feature) 
DO UPDATE SET 
  status = EXCLUDED.status, 
  valid_until = EXCLUDED.valid_until,
  updated_at = NOW();
