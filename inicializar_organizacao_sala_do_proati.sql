-- Coloca todos os dispositivos inicialmente em uma unica categoria.
-- Depois, use a aba Organizacao para selecionar e mover os dispositivos
-- para novas salas, bases ou categorias.

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

UPDATE public.devices
SET "group" = 'Sala do Proati';

SELECT
    COUNT(*) AS total_dispositivos,
    COUNT(*) FILTER (WHERE "group" = 'Sala do Proati') AS na_sala_do_proati,
    COUNT(DISTINCT "group") AS total_categorias
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
