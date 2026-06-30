-- =======================================================
-- MIGRATION: Restrict push_subscriptions RLS (V33)
-- Causa raiz: Frontend escrevendo diretamente no banco gerava
-- inconsistências e falhas silenciosas de segurança.
-- Esta migração remove todas as permissões de escrita
-- (INSERT, UPDATE, DELETE) do cliente e mantém apenas SELECT.
-- =======================================================

-- 1. Limpa todas as políticas existentes para garantir consistência
DROP POLICY IF EXISTS "Allow users to insert own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow users to read own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow users to delete own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow users to update own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Service role full access push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_insert_update" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_read_only_select" ON public.push_subscriptions;

-- 2. Habilita RLS na tabela
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Cria a política unicamente de leitura (SELECT) para o usuário dono do registro
CREATE POLICY "push_read_only_select"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
