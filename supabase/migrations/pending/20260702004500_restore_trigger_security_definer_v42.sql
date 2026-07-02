-- =======================================================
-- MIGRATION: RESTORE SECURITY DEFINER FOR TRIGGERS (V42)
-- Objetivo: Restaurar a execução dos triggers de tasks/goals
-- como SECURITY DEFINER para permitir escrita na fila de
-- notificações e evitar rollback no CRUD de tarefas.
-- =======================================================

-- 1. Alterar as funções dos triggers de volta para SECURITY DEFINER com search_path explícito
ALTER FUNCTION public.trg_tasks_unified_eda_func() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.trg_goals_unified_eda_func() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.handle_task_events() SECURITY DEFINER SET search_path = public;

-- 2. Conceder direitos de execução para usuários autenticados
-- (Necessário para que o trigger consiga ser disparado na sessão do cliente)
GRANT EXECUTE ON FUNCTION public.trg_tasks_unified_eda_func() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_goals_unified_eda_func() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_task_events() TO authenticated;
