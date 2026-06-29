-- ====================================================================
-- MIGRATION: CREATE PAYMENT_EVENTS TABLE FOR HARDENED BILLING (V14)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'premium',
  processed_at TIMESTAMPTZ DEFAULT now(),
  raw_payload JSONB
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Select policies: Allow users to read their own payment events, and admins to read all
DROP POLICY IF EXISTS "Allow users to read own payment events" ON public.payment_events;
CREATE POLICY "Allow users to read own payment events"
  ON public.payment_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow admins to read all payment events" ON public.payment_events;
CREATE POLICY "Allow admins to read all payment events"
  ON public.payment_events FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'email' = 'admin@flowday.app') OR
    (auth.jwt()->>'email' = 'rafaelle@flowday.app') OR
    (auth.jwt()->>'email' = 'rafox@flowday.app')
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON public.payment_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON public.payment_events(user_id);

-- Cache refresh
NOTIFY pgrst, 'reload schema';
