-- ─── MIGRATION SQL: FLOWDAY FASE 2 ───

-- 1. Adicionar data de conclusão nas tarefas para análise de produtividade temporal
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

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

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para perfis
CREATE POLICY "Allow users to read own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Allow users to insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 3. Trigger automático para criar o perfil na criação do usuário
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

-- 4. Garantir que o bucket de avatares existe e possui políticas públicas
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para avatars
DROP POLICY IF EXISTS "Allow public read of avatars" ON storage.objects;
CREATE POLICY "Allow public read of avatars" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow authenticated upload of avatars" ON storage.objects;
CREATE POLICY "Allow authenticated upload of avatars" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow owner update of avatars" ON storage.objects;
CREATE POLICY "Allow owner update of avatars" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow owner delete of avatars" ON storage.objects;
CREATE POLICY "Allow owner delete of avatars" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'avatars');
