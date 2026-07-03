-- 1. Restrição composto de idempotência real (provider_event_id + event_type)
DROP INDEX IF EXISTS idx_billing_events_provider_event_id;
DROP INDEX IF EXISTS idx_billing_events_provider_id_type;
CREATE UNIQUE INDEX idx_billing_events_provider_id_type 
ON public.billing_events(provider_event_id, event_type);

-- 2. Trigger para bloquear alteração direta de colunas de billing em profiles
CREATE OR REPLACE FUNCTION block_direct_profile_billing_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas interceptar se a role atual for 'authenticated' (Supabase Client do Usuário)
  IF current_setting('role') = 'authenticated' THEN
    IF OLD.plano IS DISTINCT FROM NEW.plano OR 
       OLD.assinatura_status IS DISTINCT FROM NEW.assinatura_status OR 
       OLD.assinatura_expira_em IS DISTINCT FROM NEW.assinatura_expira_em OR 
       OLD.assinatura_inicio IS DISTINCT FROM NEW.assinatura_inicio THEN
      RAISE EXCEPTION 'Não é permitido alterar colunas de faturamento diretamente.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_block_profile_billing_mutation ON public.profiles;
CREATE TRIGGER trigger_block_profile_billing_mutation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION block_direct_profile_billing_mutation();
