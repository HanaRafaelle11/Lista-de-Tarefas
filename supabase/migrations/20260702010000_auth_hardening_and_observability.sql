-- 1. Novas colunas de controle na tabela de perfis
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_password BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dismissed_password_prompt BOOLEAN DEFAULT FALSE;

-- 2. Tabela de logs de auditoria de autenticação
CREATE TABLE IF NOT EXISTS public.auth_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    event_type VARCHAR(100) NOT NULL, -- 'login_success', 'login_failed', 'email_sent_success', 'email_sent_failed', 'password_reset_request', etc.
    email VARCHAR(255),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

-- Permitir inserção anônima e autenticada
CREATE POLICY "Allow anonymous and authenticated inserts" 
ON public.auth_logs FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);
