-- Proteção transacional contra empréstimos simultâneos do mesmo dispositivo.
-- Execute este arquivo uma vez no SQL Editor do Supabase, depois das migrações
-- de devolução individual e prazo de empréstimos.

CREATE OR REPLACE FUNCTION public.reserve_device_for_loan()
RETURNS TRIGGER AS $$
DECLARE
    loan_is_returned BOOLEAN;
    device_label TEXT;
BEGIN
    SELECT returned
    INTO loan_is_returned
    FROM public.loans
    WHERE id = NEW.loan_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'LOAN_NOT_FOUND';
    END IF;

    IF loan_is_returned THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'LOAN_ALREADY_RETURNED';
    END IF;

    IF COALESCE(NEW.return_status, 'pending') <> 'pending' THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'INVALID_INITIAL_RETURN_STATUS';
    END IF;

    SELECT COALESCE(NULLIF(patrimony, ''), NULLIF(counter_number, ''), id::TEXT)
    INTO device_label
    FROM public.devices
    WHERE id = NEW.device_id;

    UPDATE public.devices
    SET status = 'Em uso'
    WHERE id = NEW.device_id
      AND status = 'Disponível';

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'DEVICE_NOT_AVAILABLE:' || COALESCE(device_label, NEW.device_id::TEXT);
    END IF;

    NEW.return_status := 'pending';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS reserve_device_for_loan_trigger ON public.loan_devices;
CREATE TRIGGER reserve_device_for_loan_trigger
BEFORE INSERT ON public.loan_devices
FOR EACH ROW
EXECUTE FUNCTION public.reserve_device_for_loan();

CREATE OR REPLACE FUNCTION public.register_device_loan(
    p_class_id BIGINT,
    p_teacher_id BIGINT,
    p_device_type TEXT,
    p_quantity INTEGER,
    p_loan_type TEXT,
    p_group_name TEXT,
    p_date_time TEXT,
    p_due_at TIMESTAMP WITH TIME ZONE,
    p_releaser TEXT,
    p_observations TEXT,
    p_device_ids BIGINT[],
    p_existing_loan_id BIGINT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    existing_loan public.loans%ROWTYPE;
    registered_loan_id BIGINT;
    device_count INTEGER;
    unique_device_count INTEGER;
    unavailable_devices TEXT;
BEGIN
    IF NOT public.is_access_staff() THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'STAFF_AUTHENTICATION_REQUIRED';
    END IF;

    IF p_class_id IS NULL OR p_teacher_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RESPONSIBLE_REQUIRED';
    END IF;

    IF p_quantity IS NULL OR p_quantity < 1 OR p_device_ids IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_DEVICE_QUANTITY';
    END IF;

    SELECT COUNT(*)
    INTO unique_device_count
    FROM (SELECT DISTINCT UNNEST(p_device_ids) AS device_id) AS selected_devices;

    IF CARDINALITY(p_device_ids) <> p_quantity OR unique_device_count <> p_quantity THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DEVICE_QUANTITY_MISMATCH';
    END IF;

    IF p_existing_loan_id IS NOT NULL THEN
        SELECT *
        INTO existing_loan
        FROM public.loans
        WHERE id = p_existing_loan_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LOAN_NOT_FOUND';
        END IF;

        IF existing_loan.returned THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LOAN_ALREADY_RETURNED';
        END IF;

        IF existing_loan.class_id <> p_class_id OR existing_loan.teacher_id <> p_teacher_id THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LOAN_RESPONSIBLE_MISMATCH';
        END IF;
    END IF;

    -- Todos os registros são bloqueados na mesma ordem. Uma segunda tentativa
    -- simultânea aguarda a primeira e depois enxerga o status atualizado.
    PERFORM id
    FROM public.devices
    WHERE id = ANY(p_device_ids)
    ORDER BY id
    FOR UPDATE;

    SELECT COUNT(*)
    INTO device_count
    FROM public.devices
    WHERE id = ANY(p_device_ids);

    IF device_count <> p_quantity THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DEVICE_NOT_FOUND';
    END IF;

    SELECT STRING_AGG(
        COALESCE(NULLIF(patrimony, ''), NULLIF(counter_number, ''), id::TEXT),
        ', '
        ORDER BY id
    )
    INTO unavailable_devices
    FROM public.devices
    WHERE id = ANY(p_device_ids)
      AND status <> 'Disponível';

    IF unavailable_devices IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'DEVICE_NOT_AVAILABLE:' || unavailable_devices;
    END IF;

    IF p_existing_loan_id IS NULL THEN
        INSERT INTO public.loans (
            class_id,
            teacher_id,
            device_type,
            quantity,
            loan_type,
            group_name,
            date_time,
            due_at,
            releaser,
            observations,
            returned
        )
        VALUES (
            p_class_id,
            p_teacher_id,
            p_device_type,
            p_quantity,
            p_loan_type,
            NULLIF(p_group_name, ''),
            p_date_time,
            p_due_at,
            p_releaser,
            NULLIF(p_observations, ''),
            false
        )
        RETURNING id INTO registered_loan_id;
    ELSE
        UPDATE public.loans
        SET
            quantity = quantity + p_quantity,
            device_type = CASE
                WHEN device_type = p_device_type THEN device_type
                ELSE 'Diversos'
            END,
            loan_type = CASE
                WHEN device_type = p_device_type AND loan_type = p_loan_type THEN loan_type
                ELSE 'quantity'
            END,
            group_name = CASE
                WHEN device_type = p_device_type
                 AND COALESCE(group_name, '') = COALESCE(p_group_name, '')
                    THEN NULLIF(group_name, '')
                ELSE NULL
            END,
            due_at = COALESCE(p_due_at, due_at),
            observations = NULLIF(
                CONCAT_WS(E'\n', NULLIF(observations, ''), NULLIF(p_observations, '')),
                ''
            )
        WHERE id = p_existing_loan_id
        RETURNING id INTO registered_loan_id;
    END IF;

    INSERT INTO public.loan_devices (loan_id, device_id)
    SELECT registered_loan_id, selected_device_id
    FROM UNNEST(p_device_ids) AS selected_device_id;

    RETURN registered_loan_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.register_device_loan(
    BIGINT, BIGINT, TEXT, INTEGER, TEXT, TEXT, TEXT,
    TIMESTAMP WITH TIME ZONE, TEXT, TEXT, BIGINT[], BIGINT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_device_loan(
    BIGINT, BIGINT, TEXT, INTEGER, TEXT, TEXT, TEXT,
    TIMESTAMP WITH TIME ZONE, TEXT, TEXT, BIGINT[], BIGINT
) TO authenticated;

-- A devolução é sincronizada no banco para que o aparelho volte a ficar
-- disponível mesmo se o navegador for fechado após concluir o empréstimo.
CREATE OR REPLACE FUNCTION public.sync_device_status_after_return()
RETURNS TRIGGER AS $$
BEGIN
    IF COALESCE(NEW.return_status, 'pending') <> 'pending'
       AND NOT EXISTS (
           SELECT 1
           FROM public.loan_devices AS pending_link
           JOIN public.loans AS pending_loan ON pending_loan.id = pending_link.loan_id
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
