-- ====================================================================
-- SCRIPT DE ROLLBACK PARA MIGRATION CONSOLIDADA V31
-- ====================================================================

BEGIN;

-- 1. Restaurar permissões e desabilitar FORCE RLS nas tabelas existentes
ALTER TABLE public.events NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read own events" ON public.events;
DROP POLICY IF EXISTS "Allow authenticated insert own events" ON public.events;
GRANT SELECT, INSERT ON public.events TO anon;

ALTER TABLE public.billing_ledger NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read own billing ledger" ON public.billing_ledger;
GRANT SELECT ON public.billing_ledger TO anon;

ALTER TABLE public.notification_queue NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read own notifications" ON public.notification_queue;
GRANT SELECT ON public.notification_queue TO anon;

ALTER TABLE public.schema_migrations NO FORCE ROW LEVEL SECURITY;
GRANT SELECT ON public.schema_migrations TO anon, authenticated;

-- 2. Remover tabelas criadas pela V31 (se necessário reverter completamente)
DROP TABLE IF EXISTS public.growth_action_results CASCADE;
DROP TABLE IF EXISTS public.growth_actions CASCADE;
DROP TABLE IF EXISTS public.revenue_leaks CASCADE;
DROP TABLE IF EXISTS public.user_risk_profile CASCADE;
DROP TABLE IF EXISTS public.payment_events CASCADE;
DROP TABLE IF EXISTS public.billing_traces CASCADE;
DROP TABLE IF EXISTS public.billing_locks CASCADE;
DROP TABLE IF EXISTS public.billing_idempotency CASCADE;
DROP TABLE IF EXISTS public.feedback CASCADE;

COMMIT;

NOTIFY pgrst, 'reload schema';
