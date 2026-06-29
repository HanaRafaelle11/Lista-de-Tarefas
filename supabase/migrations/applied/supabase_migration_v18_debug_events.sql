-- ====================================================================
-- MIGRATION: CREATE DEBUG EVENTS RPC (V18)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.debug_events()
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER -- Executa sob o contexto de quem chamou para capturar o auth.uid() real
AS $$
BEGIN
  RETURN json_build_object(
    'auth_uid', auth.uid(),
    'current_user', current_user
  );
END;
$$;

-- Permitir acesso público para fins de depuração
GRANT EXECUTE ON FUNCTION public.debug_events() TO anon, authenticated, service_role;
