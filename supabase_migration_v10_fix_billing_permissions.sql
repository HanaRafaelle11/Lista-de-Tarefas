-- ====================================================================
-- MIGRATION: FIX BILLING COLUMNS AND GRANTS ON PROFILES (V10)
-- ====================================================================

-- 1. Garante que todas as colunas de faturamento existam na tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano TEXT DEFAULT 'free' CHECK (plano IN ('free', 'premium')),
  ADD COLUMN IF NOT EXISTS assinatura_status TEXT DEFAULT 'free' CHECK (assinatura_status IN ('active', 'canceled', 'past_due', 'free')),
  ADD COLUMN IF NOT EXISTS assinatura_inicio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assinatura_expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mercadopago_customer_id TEXT;

-- 2. Concede permissões explícitas de SELECT e UPDATE para as roles públicas do Supabase
-- Isso corrige o erro onde o PostgREST (API) retorna que a coluna "não existe"
-- para usuários autenticados ou anônimos por falta de permissão de seleção.
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- Re-publicar schema no cache do PostgREST
NOTIFY pgrst, 'reload schema';
