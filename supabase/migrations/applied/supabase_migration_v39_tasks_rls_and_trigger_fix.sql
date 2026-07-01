-- =======================================================
-- MIGRATION: TASKS RLS & TRIGGER EXECUTION FIX (V39)
-- Objetivo: Corrigir exclusão de tarefas em public.tasks e
-- restaurar execução do trigger para usuários autenticados.
-- =======================================================

-- ── 1. CORREÇÃO DA POLÍTICA DE EXCLUSÃO (DELETE) EM public.tasks ──

-- Garantir RLS ativo na tabela tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas de exclusão
DROP POLICY IF EXISTS "Allow authenticated users to delete own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks." ON public.tasks;
DROP POLICY IF EXISTS "allow_delete_own_tasks" ON public.tasks;
DROP POLICY IF EXISTS "delete_tasks" ON public.tasks;

-- Criar a nova política de exclusão restrita ao dono
CREATE POLICY "Allow authenticated users to delete own tasks" 
ON public.tasks FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);


-- ── 2. DIREITOS DE EXECUÇÃO DOS TRIGGERS & ACESSO À FILA DE NOTIFICAÇÕES ──

-- Conceder permissão de execução nos triggers para usuários autenticados
-- (Necessário para que a operação de INSERT/UPDATE/DELETE dispare o trigger sem erros de permissão)
GRANT EXECUTE ON FUNCTION public.trg_tasks_unified_eda_func() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_goals_unified_eda_func() TO authenticated;

-- Garantir privilégios básicos na tabela notification_queue
GRANT INSERT, SELECT, UPDATE, DELETE ON public.notification_queue TO authenticated, service_role;
