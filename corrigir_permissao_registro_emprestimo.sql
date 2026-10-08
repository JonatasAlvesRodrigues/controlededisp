-- Corrige a permissao para registrar emprestimos com dispositivos escolhidos.
-- Execute este arquivo uma vez no SQL Editor do Supabase.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.register_device_loan(
    BIGINT, BIGINT, TEXT, INTEGER, TEXT, TEXT, TEXT,
    TIMESTAMP WITH TIME ZONE, TEXT, TEXT, BIGINT[], BIGINT
) TO authenticated;
