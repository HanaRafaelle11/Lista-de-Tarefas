-- ====================================================================
-- MIGRATION: CREATE PAYMENT_LEDGER TABLE FOR FINTECH-GRADE BILLING (V15)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.payment_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status_raw TEXT,
  status_normalized TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.payment_ledger ENABLE ROW LEVEL SECURITY;

-- Select policies: Allow users to read their own payment ledger, and admins to read all
DROP POLICY IF EXISTS "Allow users to read own payment ledger" ON public.payment_ledger;
CREATE POLICY "Allow users to read own payment ledger"
  ON public.payment_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow admins to read all payment ledger" ON public.payment_ledger;
CREATE POLICY "Allow admins to read all payment ledger"
  ON public.payment_ledger FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'email' = 'admin@flowday.app') OR
    (auth.jwt()->>'email' = 'rafaelle@flowday.app') OR
    (auth.jwt()->>'email' = 'rafox@flowday.app')
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_ledger_payment_id ON public.payment_ledger(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_user_id ON public.payment_ledger(user_id);

-- Cache refresh
NOTIFY pgrst, 'reload schema';
