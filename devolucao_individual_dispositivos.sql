-- Devolução individual de dispositivos por empréstimo.
-- Execute este arquivo uma vez no SQL Editor do Supabase.

ALTER TABLE public.loan_devices
ADD COLUMN IF NOT EXISTS return_status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS returned_by TEXT,
ADD COLUMN IF NOT EXISTS return_observations TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'loan_devices_return_status_check'
          AND conrelid = 'public.loan_devices'::regclass
    ) THEN
        ALTER TABLE public.loan_devices
        ADD CONSTRAINT loan_devices_return_status_check
        CHECK (return_status IN ('pending', 'returned', 'damaged'));
    END IF;
END $$;

-- Compatibilidade com empréstimos que já estavam encerrados antes desta alteração.
UPDATE public.loan_devices AS loan_device
SET
    return_status = CASE
        WHEN loan.return_status = 'damaged' THEN 'damaged'
        ELSE 'returned'
    END,
    returned_at = COALESCE(loan.created_at, NOW()),
    return_observations = COALESCE(
        loan_device.return_observations,
        loan.return_observations,
        'Devolução anterior à implantação do controle individual.'
    )
FROM public.loans AS loan
WHERE loan.id = loan_device.loan_id
  AND loan.returned = true
  AND loan_device.return_status = 'pending';

ALTER TABLE public.loan_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operacao atualiza devolucao loan_devices" ON public.loan_devices;
CREATE POLICY "Operacao atualiza devolucao loan_devices"
ON public.loan_devices
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS loan_devices_loan_return_status_idx
ON public.loan_devices (loan_id, return_status);
