-- Corrige somente os patrimonios repetidos e ativa a geracao automatica
-- para todos os proximos dispositivos cadastrados.
-- Execute este arquivo inteiro no SQL Editor do Supabase.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.devices'::regclass
          AND tgname = 'protect_device_non_admin_update_trigger'
          AND NOT tgisinternal
    ) THEN
        ALTER TABLE public.devices
            DISABLE TRIGGER protect_device_non_admin_update_trigger;
    END IF;
END $$;

-- Mantem o dispositivo de menor ID de cada patrimonio e renumera apenas os
-- demais registros que estavam repetidos.
WITH repeated_devices AS (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY btrim(patrimony)
                ORDER BY id
            ) AS position
        FROM public.devices
        WHERE NULLIF(btrim(patrimony), '') IS NOT NULL
    ) AS ranked
    WHERE position > 1
)
UPDATE public.devices AS d
SET patrimony = format('__tmp_duplicate_patrimony_%s_%s__', txid_current(), d.id)
FROM repeated_devices AS r
WHERE d.id = r.id;

WITH target AS (
    SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY type, id) AS target_position
    FROM public.devices
    WHERE strpos(patrimony, '__tmp_duplicate_patrimony_') = 1
),
occupied_patrimonies AS (
    SELECT DISTINCT btrim(patrimony) AS patrimony
    FROM public.devices
    WHERE NULLIF(btrim(patrimony), '') IS NOT NULL
      AND strpos(patrimony, '__tmp_duplicate_patrimony_') <> 1
),
candidate_numbers AS (
    SELECT n
    FROM generate_series(
        0,
        (SELECT COUNT(*) FROM target) + (SELECT COUNT(*) FROM occupied_patrimonies)
    ) AS n
),
available_patrimonies AS (
    SELECT
        n,
        ROW_NUMBER() OVER (ORDER BY n) AS available_position,
        format(
            '2026.%s.%s.00',
            lpad((n / 1000)::text, 3, '0'),
            lpad((n % 1000)::text, 3, '0')
        ) AS patrimony
    FROM candidate_numbers
    WHERE NOT EXISTS (
        SELECT 1
        FROM occupied_patrimonies AS op
        WHERE op.patrimony = format(
            '2026.%s.%s.00',
            lpad((n / 1000)::text, 3, '0'),
            lpad((n % 1000)::text, 3, '0')
        )
    )
),
new_patrimonies AS (
    SELECT target.id, available_patrimonies.patrimony
    FROM target
    JOIN available_patrimonies
      ON available_patrimonies.available_position = target.target_position
)
UPDATE public.devices AS d
SET patrimony = n.patrimony
FROM new_patrimonies AS n
WHERE d.id = n.id;

-- Impede que qualquer patrimonio preenchido se repita daqui em diante.
CREATE UNIQUE INDEX IF NOT EXISTS devices_patrimony_unique_not_blank
ON public.devices ((btrim(patrimony)))
WHERE NULLIF(btrim(patrimony), '') IS NOT NULL;

-- Gera automaticamente o primeiro patrimonio livre quando um novo
-- dispositivo for inserido sem patrimonio. O lock evita colisao entre dois
-- cadastros feitos ao mesmo tempo.
CREATE OR REPLACE FUNCTION public.assign_automatic_device_patrimony()
RETURNS TRIGGER AS $$
DECLARE
    next_patrimony TEXT;
BEGIN
    IF NULLIF(btrim(NEW.patrimony), '') IS NULL THEN
        PERFORM pg_advisory_xact_lock(2026000000);

        SELECT format(
            '2026.%s.%s.00',
            lpad((n / 1000)::text, 3, '0'),
            lpad((n % 1000)::text, 3, '0')
        )
        INTO next_patrimony
        FROM generate_series(
            0,
            (SELECT COUNT(*) FROM public.devices) + 1
        ) AS n
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.devices AS d
            WHERE btrim(d.patrimony) = format(
                '2026.%s.%s.00',
                lpad((n / 1000)::text, 3, '0'),
                lpad((n % 1000)::text, 3, '0')
            )
        )
        ORDER BY n
        LIMIT 1;

        NEW.patrimony := next_patrimony;
    ELSE
        NEW.patrimony := btrim(NEW.patrimony);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assign_automatic_device_patrimony_trigger ON public.devices;
CREATE TRIGGER assign_automatic_device_patrimony_trigger
BEFORE INSERT ON public.devices
FOR EACH ROW EXECUTE FUNCTION public.assign_automatic_device_patrimony();

-- Confere o resultado antes de encerrar.
SELECT
    COUNT(*) AS total_dispositivos,
    COUNT(DISTINCT NULLIF(btrim(patrimony), '')) AS patrimonios_unicos,
    COUNT(*) - COUNT(DISTINCT NULLIF(btrim(patrimony), '')) AS diferenca
FROM public.devices;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.devices'::regclass
          AND tgname = 'protect_device_non_admin_update_trigger'
          AND NOT tgisinternal
    ) THEN
        ALTER TABLE public.devices
            ENABLE TRIGGER protect_device_non_admin_update_trigger;
    END IF;
END $$;

COMMIT;
