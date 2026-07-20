-- Segurança real com RLS no Supabase
-- Execute depois de controle_acesso_usuarios.sql e historico_alteracoes_dispositivos.sql.
--
-- Observação sobre "Acesso Rápido":
-- como ele não faz login no Supabase, o banco enxerga esses usos como role "anon".
-- Por isso anon fica limitado a leitura + fluxo operacional de empréstimo/devolução.

CREATE OR REPLACE FUNCTION public.access_role()
RETURNS TEXT AS $$
DECLARE
    profile_role TEXT;
BEGIN
    SELECT role INTO profile_role
    FROM public.user_profiles
    WHERE id = auth.uid();

    RETURN COALESCE(profile_role, 'anon');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_access_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.access_role() IN ('admin', 'funcionario');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.protect_device_non_admin_update()
RETURNS TRIGGER AS $$
BEGIN
    IF public.is_access_admin() THEN
        RETURN NEW;
    END IF;

    IF to_jsonb(NEW) - 'status' <> to_jsonb(OLD) - 'status' THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar dados cadastrais de dispositivos.';
    END IF;

    IF NEW.status NOT IN ('Disponível', 'Em uso')
       AND NOT (OLD.status = 'Em uso' AND NEW.status = 'Manutenção') THEN
        RAISE EXCEPTION 'Apenas administradores podem colocar dispositivos em manutenção ou fora de uso.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_device_non_admin_update_trigger ON public.devices;
CREATE TRIGGER protect_device_non_admin_update_trigger
BEFORE UPDATE ON public.devices
FOR EACH ROW EXECUTE FUNCTION public.protect_device_non_admin_update();

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_maintenance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Limpa políticas anteriores com os mesmos nomes.
DROP POLICY IF EXISTS "Leitura geral classes" ON public.classes;
DROP POLICY IF EXISTS "Equipe gerencia classes" ON public.classes;
DROP POLICY IF EXISTS "Leitura geral teachers" ON public.teachers;
DROP POLICY IF EXISTS "Equipe gerencia teachers" ON public.teachers;
DROP POLICY IF EXISTS "Leitura geral devices" ON public.devices;
DROP POLICY IF EXISTS "Admin cria devices" ON public.devices;
DROP POLICY IF EXISTS "Admin apaga devices" ON public.devices;
DROP POLICY IF EXISTS "Operacao atualiza status devices" ON public.devices;
DROP POLICY IF EXISTS "Leitura geral loans" ON public.loans;
DROP POLICY IF EXISTS "Operacao cria loans" ON public.loans;
DROP POLICY IF EXISTS "Operacao devolve loans" ON public.loans;
DROP POLICY IF EXISTS "Leitura geral loan_devices" ON public.loan_devices;
DROP POLICY IF EXISTS "Operacao cria loan_devices" ON public.loan_devices;
DROP POLICY IF EXISTS "Leitura geral manutencao" ON public.device_maintenance_history;
DROP POLICY IF EXISTS "Admin cria manutencao" ON public.device_maintenance_history;
DROP POLICY IF EXISTS "Leitura geral alteracoes" ON public.device_change_history;
DROP POLICY IF EXISTS "Admin cria alteracoes" ON public.device_change_history;

CREATE POLICY "Leitura geral classes"
ON public.classes FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Equipe gerencia classes"
ON public.classes FOR ALL
TO authenticated
USING (public.is_access_staff())
WITH CHECK (public.is_access_staff());

CREATE POLICY "Leitura geral teachers"
ON public.teachers FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Equipe gerencia teachers"
ON public.teachers FOR ALL
TO authenticated
USING (public.is_access_staff())
WITH CHECK (public.is_access_staff());

CREATE POLICY "Leitura geral devices"
ON public.devices FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admin cria devices"
ON public.devices FOR INSERT
TO authenticated
WITH CHECK (public.is_access_admin());

CREATE POLICY "Admin apaga devices"
ON public.devices FOR DELETE
TO authenticated
USING (public.is_access_admin());

CREATE POLICY "Operacao atualiza status devices"
ON public.devices FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Leitura geral loans"
ON public.loans FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Operacao cria loans"
ON public.loans FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Operacao devolve loans"
ON public.loans FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Leitura geral loan_devices"
ON public.loan_devices FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Operacao cria loan_devices"
ON public.loan_devices FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Leitura geral manutencao"
ON public.device_maintenance_history FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admin cria manutencao"
ON public.device_maintenance_history FOR INSERT
TO authenticated
WITH CHECK (public.is_access_admin());

CREATE POLICY "Leitura geral alteracoes"
ON public.device_change_history FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admin cria alteracoes"
ON public.device_change_history FOR INSERT
TO authenticated
WITH CHECK (public.is_access_admin());
