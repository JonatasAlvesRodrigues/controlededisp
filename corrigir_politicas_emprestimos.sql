-- Restaura as permissões de criação de empréstimos removidas pela RLS.
-- Execute este arquivo no SQL Editor do Supabase após
-- seguranca_rls_supabase.sql.

DROP POLICY IF EXISTS "Operacao cria loans" ON public.loans;
CREATE POLICY "Operacao cria loans"
ON public.loans FOR INSERT
TO authenticated
WITH CHECK (public.is_access_staff());

DROP POLICY IF EXISTS "Operacao cria loan_devices" ON public.loan_devices;
CREATE POLICY "Operacao cria loan_devices"
ON public.loan_devices FOR INSERT
TO authenticated
WITH CHECK (public.is_access_staff());
