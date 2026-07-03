-- 1. Restringir totalmente a tabela subscriptions para usuários comuns
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Allow users to update own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Allow users to read own subscription" ON public.subscriptions;

-- Permitir apenas leitura das próprias assinaturas
CREATE POLICY "Allow users to read own subscription" 
ON public.subscriptions FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 2. Restringir colunas críticas na tabela profiles via Trigger de Proteção
CREATE OR REPLACE FUNCTION public.protect_profile_billing_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a chamada for de um usuário comum (não service_role), impede alteração das colunas de faturamento
  IF current_setting('role') = 'authenticated' THEN
    IF NEW.plano IS DISTINCT FROM OLD.plano OR
       NEW.assinatura_status IS DISTINCT FROM OLD.assinatura_status OR
       NEW.assinatura_expira_em IS DISTINCT FROM OLD.assinatura_expira_em OR
       NEW.asaas_customer_id IS DISTINCT FROM OLD.asaas_customer_id THEN
      RAISE EXCEPTION 'Acesso negado: Colunas de faturamento só podem ser alteradas pelo sistema.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_billing ON public.profiles;
CREATE TRIGGER trg_protect_profile_billing
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_billing_fields();
