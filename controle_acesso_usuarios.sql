-- Controle de acesso por perfil de usuario
-- Perfis usados pelo app:
-- - admin: pode adicionar, editar, apagar e colocar dispositivos em manutencao
-- - funcionario: pode usar o sistema, mas nao gerencia cadastro/status dos dispositivos
-- - aluno: acesso focado em emprestimos e devolucoes

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'funcionario',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    CONSTRAINT user_profiles_role_check CHECK (role IN ('admin', 'funcionario', 'aluno'))
);

CREATE OR REPLACE FUNCTION public.is_access_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'funcionario')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(public.user_profiles.name, EXCLUDED.name),
        updated_at = TIMEZONE('utc'::text, NOW());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios veem perfis" ON public.user_profiles;
CREATE POLICY "Usuarios veem perfis"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = id
    OR public.is_access_admin()
);

DROP POLICY IF EXISTS "Usuario cria proprio perfil" ON public.user_profiles;
CREATE POLICY "Usuario cria proprio perfil"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id AND role = 'funcionario');

DROP POLICY IF EXISTS "Usuario atualiza proprio nome" ON public.user_profiles;

DROP POLICY IF EXISTS "Admins atualizam perfis" ON public.user_profiles;
CREATE POLICY "Admins atualizam perfis"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (public.is_access_admin())
WITH CHECK (public.is_access_admin());

-- Como definir administradores:
-- Troque o email abaixo pelo email da pessoa que sera admin e execute no SQL Editor.
-- UPDATE public.user_profiles SET role = 'admin', updated_at = NOW() WHERE email = 'email@escola.com';

-- Como voltar alguem para funcionario:
-- UPDATE public.user_profiles SET role = 'funcionario', updated_at = NOW() WHERE email = 'email@escola.com';

-- Como marcar alguem como aluno:
-- UPDATE public.user_profiles SET role = 'aluno', updated_at = NOW() WHERE email = 'email@escola.com';
