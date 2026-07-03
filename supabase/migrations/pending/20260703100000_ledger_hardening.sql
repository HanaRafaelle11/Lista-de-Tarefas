-- 1. Hardening de Colunas no Ledger
ALTER TABLE public.billing_events ADD COLUMN IF NOT EXISTS provider_event_id TEXT;

-- 2. Restrição única física de idempotência (Stripe-like)
DROP INDEX IF EXISTS idx_billing_events_provider_event_id;
CREATE UNIQUE INDEX idx_billing_events_provider_event_id 
ON public.billing_events(provider_event_id);

-- 3. Habilitar RLS estrito na tabela billing_events (Imutabilidade)
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select own billing events" ON public.billing_events;
CREATE POLICY "Allow select own billing events"
ON public.billing_events FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

-- Nota: Não criamos políticas de UPDATE ou DELETE para autenticados,
-- travando a tabela como imutável (Insert/Select apenas).
