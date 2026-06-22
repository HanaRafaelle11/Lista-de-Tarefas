-- =======================================================
-- MIGRATION: FEEDBACK TABLE (V8)
-- =======================================================

CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anonymous users to insert feedback
DROP POLICY IF EXISTS "Allow anyone to insert feedback" ON public.feedback;
CREATE POLICY "Allow anyone to insert feedback" 
  ON public.feedback FOR INSERT 
  TO authenticated, anon 
  WITH CHECK (true);

-- Allow admins to read all feedback
DROP POLICY IF EXISTS "Allow admins to read all feedback" ON public.feedback;
CREATE POLICY "Allow admins to read all feedback" 
  ON public.feedback FOR SELECT 
  TO authenticated 
  USING (
    (auth.jwt()->>'email' = 'admin@flowday.app') OR 
    (auth.jwt()->>'email' = 'rafaelle@flowday.app') OR 
    (auth.jwt()->>'email' = 'rafox@flowday.app')
  );

-- Comment for docs
COMMENT ON TABLE public.feedback IS 'Feedback submitted by Flowday users';
