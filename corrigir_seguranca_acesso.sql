-- Atualizacao de seguranca para bancos que ja foram configurados.
-- Primeiro execute novamente a versao atualizada de protecao_emprestimos_simultaneos.sql;
-- em seguida, execute este arquivo no SQL Editor do Supabase.

-- Novas contas passam a ser alunos. Um administrador deve promover os membros
-- da equipe para "funcionario" ou "admin" apos validar o cadastro.
ALTER TABLE public.user_profiles
    ALTER COLUMN role SET DEFAULT 'aluno';

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        'aluno'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(public.user_profiles.name, EXCLUDED.name),
        updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Operacao atualiza status devices" ON public.devices;
CREATE POLICY "Operacao atualiza status devices"
ON public.devices FOR UPDATE TO authenticated
USING (public.is_access_staff())
WITH CHECK (public.is_access_staff());

DROP POLICY IF EXISTS "Operacao cria loans" ON public.loans;
DROP POLICY IF EXISTS "Operacao devolve loans" ON public.loans;
CREATE POLICY "Operacao devolve loans"
ON public.loans FOR UPDATE TO authenticated
USING (public.is_access_staff())
WITH CHECK (public.is_access_staff());

DROP POLICY IF EXISTS "Operacao cria loan_devices" ON public.loan_devices;
DROP POLICY IF EXISTS "Operacao atualiza devolucao loan_devices" ON public.loan_devices;
CREATE POLICY "Operacao atualiza devolucao loan_devices"
ON public.loan_devices FOR UPDATE TO authenticated
USING (public.is_access_staff())
WITH CHECK (public.is_access_staff());

REVOKE EXECUTE ON FUNCTION public.register_device_loan(
    BIGINT, BIGINT, TEXT, INTEGER, TEXT, TEXT, TEXT,
    TIMESTAMP WITH TIME ZONE, TEXT, TEXT, BIGINT[], BIGINT
) FROM anon;

GRANT EXECUTE ON FUNCTION public.register_device_loan(
    BIGINT, BIGINT, TEXT, INTEGER, TEXT, TEXT, TEXT,
    TIMESTAMP WITH TIME ZONE, TEXT, TEXT, BIGINT[], BIGINT
) TO authenticated;
