-- =======================================================
-- MIGRATION: MYFLOWDAY BILLING ENGINE - MERCADO PAGO INTEGRATION (V5)
-- =======================================================

-- 1. Add subscription and plan columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano TEXT DEFAULT 'free' CHECK (plano IN ('free', 'premium')),
  ADD COLUMN IF NOT EXISTS assinatura_status TEXT DEFAULT 'free' CHECK (assinatura_status IN ('active', 'canceled', 'past_due', 'free')),
  ADD COLUMN IF NOT EXISTS assinatura_inicio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assinatura_expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mercadopago_customer_id TEXT;

-- 2. Create index on billing columns for fast search and updates
CREATE INDEX IF NOT EXISTS idx_profiles_plano_status 
  ON public.profiles(plano, assinatura_status);

CREATE INDEX IF NOT EXISTS idx_profiles_mercadopago_customer_id 
  ON public.profiles(mercadopago_customer_id);

-- 3. Create billing_events table for idempotency check
CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on billing_events
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Policies for billing_events: Select allowed for owner, admins
DROP POLICY IF EXISTS "Allow users to read own billing events" ON public.billing_events;
CREATE POLICY "Allow users to read own billing events" 
  ON public.billing_events FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow admins to read all billing events" ON public.billing_events;
CREATE POLICY "Allow admins to read all billing events" 
  ON public.billing_events FOR SELECT 
  TO authenticated 
  USING (
    (auth.jwt()->>'email' = 'admin@flowday.app') OR 
    (auth.jwt()->>'email' = 'rafaelle@flowday.app') OR 
    (auth.jwt()->>'email' = 'rafox@flowday.app')
  );

-- Indexes for billing_events
CREATE INDEX IF NOT EXISTS idx_billing_events_payment_id ON public.billing_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_user_id ON public.billing_events(user_id);

-- 4. Comments for documentation
COMMENT ON COLUMN public.profiles.plano IS 'User plan: free or premium';
COMMENT ON COLUMN public.profiles.assinatura_status IS 'Mercado Pago subscription status: active, canceled, past_due, or free';
COMMENT ON COLUMN public.profiles.assinatura_inicio IS 'Start timestamp of active subscription';
COMMENT ON COLUMN public.profiles.assinatura_expira_em IS 'Expiration timestamp of subscription';
COMMENT ON COLUMN public.profiles.mercadopago_customer_id IS 'Mercado Pago Customer ID mapped to this user';
COMMENT ON TABLE public.billing_events IS 'Idempotency registry for Mercado Pago processed payments';
