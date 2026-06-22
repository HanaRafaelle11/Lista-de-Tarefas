-- =======================================================
-- MIGRATION: WEB PUSH NOTIFICATIONS TABLE (V7)
-- =======================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow users to insert own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow users to insert own subscriptions" 
  ON public.push_subscriptions FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to read own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow users to read own subscriptions" 
  ON public.push_subscriptions FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to delete own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow users to delete own subscriptions" 
  ON public.push_subscriptions FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Comment for docs
COMMENT ON TABLE public.push_subscriptions IS 'Stores Web Push API subscriptions for background notifications';
