-- =================================================================
-- MIGRATION V44: PUSH DELIVERY ARCHITECTURE OVERHAUL
-- =================================================================

-- 1. Criar tabela de entrega por dispositivo
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notification_queue(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_subscription_id UUID REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'delivered', 'expired')),
  provider_response JSONB,
  message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar RLS na tabela de entregas
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Criar política de visualização para o usuário dono da entrega
CREATE POLICY select_own_deliveries ON public.notification_deliveries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Criar política de modificação total para a service_role/admin
CREATE POLICY service_role_all_deliveries ON public.notification_deliveries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Criar função RPC atômica para o worker capturar e dar lock pessimista
CREATE OR REPLACE FUNCTION public.claim_pending_notifications(worker_id_val TEXT, limit_val INT)
RETURNS SETOF public.notification_queue AS $$
BEGIN
  RETURN QUERY
  UPDATE public.notification_queue
  SET status = 'processing',
      attempts = COALESCE(attempts, 0) + 1
  WHERE id IN (
    SELECT id 
    FROM public.notification_queue
    WHERE status IN ('pending', 'failed')
      AND scheduled_for <= NOW()
      AND (attempts IS NULL OR attempts < 5)
    ORDER BY priority DESC, scheduled_for ASC
    LIMIT limit_val
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.claim_pending_notifications(TEXT, INT) TO service_role;
