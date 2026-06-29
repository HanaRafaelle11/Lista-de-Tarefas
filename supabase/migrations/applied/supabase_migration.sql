-- 1. Adicionar data de conclusão e data de atualização nas tarefas para análise e sync
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Trigger para atualizar updated_at automaticamente no UPDATE de tasks
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_updated_at ON public.tasks;
CREATE TRIGGER trigger_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Criar a tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  nickname TEXT,
  profession TEXT,
  bio TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security (RLS) em profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para perfis
DROP POLICY IF EXISTS "Allow users to read own profile" ON public.profiles;
CREATE POLICY "Allow users to read own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.profiles;
CREATE POLICY "Allow users to insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
CREATE POLICY "Allow users to update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- RLS para Administradores lerem todos os perfis (necessário para contagem e dashboard)
DROP POLICY IF EXISTS "Allow admins to read all profiles" ON public.profiles;
CREATE POLICY "Allow admins to read all profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (
  (auth.jwt()->>'email' = 'admin@flowday.app') OR 
  (auth.jwt()->>'email' = 'rafaelle@flowday.app') OR 
  (auth.jwt()->>'email' = 'rafox@flowday.app')
);

-- 3. Criar a tabela de eventos analíticos (Fase 2)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS em events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para eventos
DROP POLICY IF EXISTS "Allow authenticated users to insert own events" ON public.events;
CREATE POLICY "Allow authenticated users to insert own events" 
ON public.events FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to view own events" ON public.events;
CREATE POLICY "Allow users to view own events" 
ON public.events FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow admins to view all events" ON public.events;
CREATE POLICY "Allow admins to view all events" 
ON public.events FOR SELECT 
TO authenticated 
USING (
  (auth.jwt()->>'email' = 'admin@flowday.app') OR 
  (auth.jwt()->>'email' = 'rafaelle@flowday.app') OR 
  (auth.jwt()->>'email' = 'rafox@flowday.app')
);

-- 4. Trigger automático para criar o perfil na criação do usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, nickname)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Se o trigger já existir, remove para recriar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Garantir que o bucket de avatares existe e possui políticas públicas
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage de Avatares (Segurança Elevada: Isolamento de Pasta por User ID)
DROP POLICY IF EXISTS "Allow public read of avatars" ON storage.objects;
CREATE POLICY "Allow public read of avatars" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow authenticated upload of avatars" ON storage.objects;
CREATE POLICY "Allow authenticated upload of avatars" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Allow owner update of avatars" ON storage.objects;
CREATE POLICY "Allow owner update of avatars" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Allow owner delete of avatars" ON storage.objects;
CREATE POLICY "Allow owner delete of avatars" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 6. Tabela de Migrações de Schema (Fase 2)
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT now(),
  checksum TEXT NOT NULL
);

-- Habilitar RLS em schema_migrations
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para schema_migrations
DROP POLICY IF EXISTS "Allow public read of migrations" ON public.schema_migrations;
CREATE POLICY "Allow public read of migrations" 
ON public.schema_migrations FOR SELECT 
TO authenticated, anon 
USING (true);

-- Registrar a migração atual
INSERT INTO public.schema_migrations (version, checksum) 
VALUES ('20260614_fase2', 'fase2_checksum_placeholder')
ON CONFLICT (version) DO NOTHING;
