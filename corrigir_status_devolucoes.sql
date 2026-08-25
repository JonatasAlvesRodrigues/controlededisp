-- Mantém o status do inventário sincronizado com as devoluções.
-- Execute este arquivo uma vez no SQL Editor do Supabase, depois de
-- devolucao_individual_dispositivos.sql.

CREATE OR REPLACE FUNCTION public.sync_device_status_after_return()
RETURNS TRIGGER AS $$
BEGIN
    -- A devolução pode ser parcial. Só libera o aparelho quando ele não
    -- estiver pendente em outro empréstimo ainda aberto.
    IF COALESCE(NEW.return_status, 'pending') <> 'pending'
       AND NOT EXISTS (
           SELECT 1
           FROM public.loan_devices AS pending_link
           JOIN public.loans AS pending_loan
             ON pending_loan.id = pending_link.loan_id
           WHERE pending_link.device_id = NEW.device_id
             AND pending_link.id <> NEW.id
             AND COALESCE(pending_link.return_status, 'pending') = 'pending'
             AND COALESCE(pending_loan.returned, false) = false
       ) THEN
        UPDATE public.devices
        SET status = CASE
            WHEN NEW.return_status = 'damaged' THEN U&'Manuten\00E7\00E3o'
            ELSE U&'Dispon\00EDvel'
        END
        WHERE id = NEW.device_id
          -- Um aparelho retirado de operação não deve ser liberado por engano.
          AND status <> U&'Fora de uso';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS sync_device_status_after_return_trigger ON public.loan_devices;
CREATE TRIGGER sync_device_status_after_return_trigger
AFTER UPDATE OF return_status ON public.loan_devices
FOR EACH ROW
WHEN (OLD.return_status IS DISTINCT FROM NEW.return_status)
EXECUTE FUNCTION public.sync_device_status_after_return();

-- Protege empréstimos antigos e qualquer fluxo que encerre o empréstimo antes
-- de atualizar seus vínculos individualmente. Ao concluir o empréstimo, todos
-- os aparelhos ainda pendentes são devolvidos e o gatilho acima os libera.
CREATE OR REPLACE FUNCTION public.return_pending_devices_with_loan()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.returned IS TRUE AND OLD.returned IS DISTINCT FROM NEW.returned THEN
        UPDATE public.loan_devices
        SET
            return_status = 'returned',
            returned_at = COALESCE(returned_at, NOW()),
            return_observations = COALESCE(
                return_observations,
                NULLIF(NEW.return_observations, '')
            )
        WHERE loan_id = NEW.id
          AND COALESCE(return_status, 'pending') = 'pending';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS return_pending_devices_with_loan_trigger ON public.loans;
CREATE TRIGGER return_pending_devices_with_loan_trigger
AFTER UPDATE OF returned ON public.loans
FOR EACH ROW
WHEN (NEW.returned IS TRUE AND OLD.returned IS DISTINCT FROM NEW.returned)
EXECUTE FUNCTION public.return_pending_devices_with_loan();

-- Corrige somente os registros já presos em "Em uso" que não pertencem a
-- nenhum empréstimo aberto. Dispositivos realmente emprestados permanecem assim.
UPDATE public.devices AS device
SET status = U&'Dispon\00EDvel'
WHERE device.status = U&'Em uso'
  AND NOT EXISTS (
      SELECT 1
      FROM public.loan_devices AS pending_link
      JOIN public.loans AS pending_loan
        ON pending_loan.id = pending_link.loan_id
      WHERE pending_link.device_id = device.id
        AND COALESCE(pending_link.return_status, 'pending') = 'pending'
        AND COALESCE(pending_loan.returned, false) = false
  );

-- Conferência após a correção.
SELECT status, COUNT(*) AS quantidade
FROM public.devices
GROUP BY status
ORDER BY status;
