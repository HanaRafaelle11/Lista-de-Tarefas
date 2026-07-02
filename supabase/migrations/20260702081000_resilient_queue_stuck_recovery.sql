-- =========================================================================
-- MIGRATION: Self-Healing Queue Stuck Recovery (20260702081000)
-- =========================================================================
-- Atualiza a função claim_pending_notifications para redefinir tarefas
-- presas no status 'processing' por mais de 15 minutos de volta para 'pending',
-- garantindo a resiliência contra crashes e interrupções sem intervenção manual.

CREATE OR REPLACE FUNCTION public.claim_pending_notifications(worker_id_val TEXT, limit_val INT)
RETURNS SETOF public.notification_queue AS $$
BEGIN
  -- 1. Recuperar registros travados em 'processing' por mais de 15 minutos (Self-Healing)
  UPDATE public.notification_queue
  SET status = 'pending',
      updated_at = NOW()
  WHERE status = 'processing'
    AND updated_at < NOW() - INTERVAL '15 minutes';

  -- 2. Capturar e travar novos registros com SKIP LOCKED (Lock de Concorrência)
  RETURN QUERY
  UPDATE public.notification_queue
  SET status = 'processing',
      updated_at = NOW(),
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

COMMENT ON FUNCTION public.claim_pending_notifications(TEXT, INT) IS 'Seleciona e bloqueia notificações pendentes, resetando automaticamente registros travados há mais de 15 minutos.';
