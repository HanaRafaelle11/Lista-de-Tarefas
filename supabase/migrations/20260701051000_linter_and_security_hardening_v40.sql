-- 1. ALTERAR AS FUNÇÕES DOS TRIGGERS PARA SECURITY INVOKER
ALTER FUNCTION public.trg_tasks_unified_eda_func() SECURITY INVOKER;
ALTER FUNCTION public.trg_goals_unified_eda_func() SECURITY INVOKER;
ALTER FUNCTION public.handle_task_events() SECURITY INVOKER;

-- 2. REVOGAR PRIVILÉGIOS PÚBLICOS EXPOSTOS (LIMPEZA DO LINTER)
REVOKE EXECUTE ON FUNCTION public.trg_tasks_unified_eda_func() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_goals_unified_eda_func() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_task_events() FROM PUBLIC, anon, authenticated;

-- 3. CORREÇÃO DE TELEMETRIA (RLS STRICT WITH CHECK)     
DROP POLICY IF EXISTS "Allow authenticated inserts" ON public.push_telemetry;
CREATE POLICY "Allow authenticated inserts" 
ON public.push_telemetry FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);