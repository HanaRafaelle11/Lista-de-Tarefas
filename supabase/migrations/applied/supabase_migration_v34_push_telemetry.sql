-- =======================================================
-- MIGRATION: Push Telemetry Table (V34)
-- =======================================================

CREATE TABLE IF NOT EXISTS public.push_telemetry (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  endpoint text,
  event_type text, -- 'sent_attempt', 'sent', 'failed', 'cleaned', 'received', 'clicked'
  status text,     -- 'success', 'error'
  error text,
  created_at timestamp DEFAULT now()
);

-- Habilita RLS para push_telemetry
ALTER TABLE public.push_telemetry ENABLE ROW LEVEL SECURITY;

-- Permite que usuários autenticados gravem telemetria (necessário para SW reportar 'received' e 'clicked')
DROP POLICY IF EXISTS "Allow authenticated users to insert telemetry" ON public.push_telemetry;
CREATE POLICY "Allow authenticated users to insert telemetry"
  ON public.push_telemetry FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Permite que usuários autenticados leiam sua própria telemetria
DROP POLICY IF EXISTS "Allow users to read own telemetry" ON public.push_telemetry;
CREATE POLICY "Allow users to read own telemetry"
  ON public.push_telemetry FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
