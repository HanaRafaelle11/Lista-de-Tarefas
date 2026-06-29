-- MIGRATION V24 — MYFLOWDAY HARDENING: UNIQUE ACTIVE SUBSCRIPTION CONSTRAINT
-- Garantia em nível de banco de dados que impede duplicidade de assinaturas ativas por usuário na ORIGEM.

-- 1. Cria um índice único parcial na tabela subscriptions
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_unique_active_user
  ON public.subscriptions (user_id)
  WHERE (status = 'active');

COMMENT ON INDEX public.idx_subscriptions_unique_active_user
  IS 'Garantia imutável em nível de banco que previne mais de 1 assinatura ativa por usuário.';
