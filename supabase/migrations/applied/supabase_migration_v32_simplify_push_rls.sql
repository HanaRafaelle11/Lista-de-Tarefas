-- =======================================================
-- MIGRATION: Simplify push_subscriptions RLS (V32)
-- Causa raiz: Políticas granulares separadas estavam gerando
-- conflito e bloqueio silencioso no upsert.
-- Esta migração unifica tudo em uma única regra "FOR ALL".
-- =======================================================

-- 1. Limpa todas as políticas legadas para evitar conflitos
DROP POLICY IF EXISTS "Allow users to insert own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow users to read own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow users to delete own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow users to update own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Service role full access push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_insert_update" ON public.push_subscriptions;

-- 2. Habilita RLS na tabela
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Cria política simplificada unificada (INSERT, SELECT, UPDATE, DELETE)
CREATE POLICY "push_insert_update"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
