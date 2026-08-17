-- Corrige uma única vez dispositivos criados por versões antigas do sistema,
-- que gravaram "Disponível" com codificação incorreta.
-- Execute este arquivo no SQL Editor do Supabase.

UPDATE public.devices
SET status = U&'Dispon\00EDvel'
WHERE status LIKE 'Dispon%vel'
  AND status <> U&'Dispon\00EDvel';

-- Conferência: o resultado esperado é uma única linha "Disponível".
SELECT status, COUNT(*) AS quantidade
FROM public.devices
GROUP BY status
ORDER BY status;
