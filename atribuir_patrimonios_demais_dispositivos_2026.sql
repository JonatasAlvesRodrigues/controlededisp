-- Atribui patrimonio novo a todos os dispositivos que NAO sao notebook.
-- Inclui tablets e qualquer outro tipo cadastrado, mas preserva todos os
-- tipos iniciados por "Notebook".
--
-- Formato: 2026.000.000.00, 2026.000.001.00 ...
-- Execute este arquivo no SQL Editor do Supabase.

BEGIN;

-- Pausa a protecao do cadastro somente se ela estiver instalada.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.devices'::regclass
          AND tgname = 'protect_device_non_admin_update_trigger'
          AND NOT tgisinternal
    ) THEN
        ALTER TABLE public.devices
            DISABLE TRIGGER protect_device_non_admin_update_trigger;
    END IF;
END $$;

-- Etapa temporaria: permite substituir numeros existentes mesmo se o banco
-- possuir uma restricao UNIQUE no campo patrimonio.
UPDATE public.devices
SET patrimony = format('__tmp_patrimony_%s_%s__', txid_current(), id)
WHERE type NOT ILIKE 'Notebook%';

WITH target AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            ORDER BY type, id
        ) AS target_position
    FROM public.devices
    WHERE type NOT ILIKE 'Notebook%'
),
notebook_patrimonies AS (
    SELECT DISTINCT btrim(patrimony) AS patrimony
    FROM public.devices
    WHERE type ILIKE 'Notebook%'
      AND NULLIF(btrim(patrimony), '') IS NOT NULL
),
candidate_numbers AS (
    -- A quantidade inclui uma margem para numeros de notebook que ja ocupam
    -- posicoes da sequencia de 2026.
    SELECT n
    FROM generate_series(
        0,
        (SELECT COUNT(*) FROM target) + (SELECT COUNT(*) FROM notebook_patrimonies) - 1
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
        FROM notebook_patrimonies AS np
        WHERE np.patrimony = format(
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
SET patrimony = new_patrimonies.patrimony
FROM new_patrimonies
WHERE d.id = new_patrimonies.id;

-- Conferencia final: todos os dispositivos devem ter patrimonio unico.
SELECT
    COUNT(*) AS total_dispositivos,
    COUNT(*) FILTER (WHERE NULLIF(btrim(patrimony), '') IS NOT NULL) AS com_patrimonio,
    COUNT(DISTINCT NULLIF(btrim(patrimony), '')) AS patrimonios_unicos,
    CASE
        WHEN COUNT(*) = COUNT(DISTINCT NULLIF(btrim(patrimony), ''))
        THEN 'OK - nenhum patrimonio repetido em todos os dispositivos'
        ELSE 'VERIFICAR - ha patrimonio ausente ou repetido'
    END AS resultado
FROM public.devices;

-- Reativa a protecao do cadastro, caso ela esteja instalada.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.devices'::regclass
          AND tgname = 'protect_device_non_admin_update_trigger'
          AND NOT tgisinternal
    ) THEN
        ALTER TABLE public.devices
            ENABLE TRIGGER protect_device_non_admin_update_trigger;
    END IF;
END $$;

COMMIT;
