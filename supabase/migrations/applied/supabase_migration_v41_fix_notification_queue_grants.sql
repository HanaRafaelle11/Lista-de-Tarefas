-- =========================================================================
-- MIGRATION V41: FIX NOTIFICATION_QUEUE TABLE PRIVILEGES FOR AUTHENTICATED ROLE
-- Causa raiz: A migração V40 (hardening de RLS) revogou por engano os privilégios
-- de INSERT, UPDATE e DELETE do role 'authenticated'. Com isso, o cliente web
-- recebia erros 42501 (violação de RLS/permissão negada) e não conseguia
-- agendar nem atualizar notificações diretamente.
-- =========================================================================

-- 1. Restaura os privilégios de tabela básicos para o role authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_queue TO authenticated;

-- (Opcional) Garante que o role service_role continue com acesso total
GRANT ALL ON public.notification_queue TO service_role;

-- Obs: As políticas de RLS criadas na V40 continuarão a filtrar os acessos,
-- garantindo que usuários autenticados só possam ler, inserir, atualizar
-- ou deletar suas próprias notificações (onde user_id = auth.uid()).
