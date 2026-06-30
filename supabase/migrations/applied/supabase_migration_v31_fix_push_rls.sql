-- =======================================================
-- MIGRATION: Fix push_subscriptions RLS for upsert (UPDATE policy)
-- Causa raiz: A tabela push_subscriptions só tinha policies
-- de INSERT, SELECT e DELETE. O upsert (usado pelo frontend)
-- precisa de UPDATE, que estava silenciosamente bloqueado pelo RLS.
-- =======================================================

-- Adiciona policy de UPDATE para push_subscriptions
DROP POLICY IF EXISTS "Allow users to update own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow users to update own subscriptions"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Verificação: listar todas as policies da tabela
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'push_subscriptions';
