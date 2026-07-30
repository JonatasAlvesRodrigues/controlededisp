-- Prazo previsto e alertas de atraso dos empréstimos.
-- Execute este arquivo uma vez no SQL Editor do Supabase.

ALTER TABLE public.loans
ADD COLUMN IF NOT EXISTS due_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS loans_active_due_at_idx
ON public.loans (due_at)
WHERE returned = false AND due_at IS NOT NULL;
