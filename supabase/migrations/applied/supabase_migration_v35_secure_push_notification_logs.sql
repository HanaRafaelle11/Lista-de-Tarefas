-- =======================================================
-- MIGRATION: Secure push_subscriptions & notification_logs (V35)
-- Objetivo: Habilitar RLS e criar políticas de acesso restritas,
-- garantindo a privacidade dos dados de usuários e permitindo
-- que a Edge Function / Vercel (service_role) operem sem bloqueios.
-- =======================================================

-- ── 1. SEGURANÇA NA TABELA: push_subscriptions ──

-- Habilita RLS na tabela
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas se houver
DROP POLICY IF EXISTS "push_read_only_select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "allow_select_own_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "allow_manage_own_subscriptions" ON public.push_subscriptions;

-- Cria política unificada para o usuário autenticado gerenciar (SELECT/INSERT/UPDATE/DELETE) suas próprias assinaturas
CREATE POLICY "allow_manage_own_subscriptions"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- ── 2. SEGURANÇA NA TABELA: notification_logs ──

-- Habilita RLS na tabela
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas se houver
DROP POLICY IF EXISTS "Allow users to read own notification_logs" ON public.notification_logs;
DROP POLICY IF EXISTS "allow_select_own_logs" ON public.notification_logs;

-- Cria política para o usuário autenticado visualizar apenas seus próprios logs de notificação
CREATE POLICY "allow_select_own_logs"
ON public.notification_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Nota: Operações de escrita (INSERT) na tabela notification_logs são efetuadas 
-- pela Edge Function e pela API da Vercel utilizando a chave 'service_role'.
-- Como o service_role ignora o RLS, nenhuma política adicional de escrita é necessária,
-- impedindo que clientes mal-intencionados forjem logs no banco de dados.
