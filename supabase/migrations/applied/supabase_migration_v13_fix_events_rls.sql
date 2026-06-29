-- ====================================================================
-- MIGRATION: FIX EVENTS RLS POLICY FOR SYSTEM LOGS (V13)
-- ====================================================================

-- Ajusta a política de inserção da tabela events para permitir que
-- chamadas da API em background (que podem rodar sem contexto de autenticação do usuário)
-- consigam gravar logs estruturados.

DROP POLICY IF EXISTS "Allow authenticated users to insert own events" ON public.events;

CREATE POLICY "Allow public and system to insert events" 
ON public.events FOR INSERT 
TO public 
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- Re-publicar schema no cache do PostgREST
NOTIFY pgrst, 'reload schema';
