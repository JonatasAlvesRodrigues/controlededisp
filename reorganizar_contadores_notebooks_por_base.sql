-- Reorganiza somente o campo counter_number dos notebooks.
--
-- Regras:
-- - Notebook Positivo (Novos): nao e alterado.
-- - Notebook comum em bom estado (Disponivel ou Em uso), do grupo Base 1:
--   Base 01 Notebook 01 ate Base 01 Notebook 40.
-- - Notebook comum em bom estado, do grupo Base 2:
--   Base 02 Notebook 01 ate Base 02 Notebook 40.
-- - Todos os outros notebooks comuns ficam como Sem Base 01, Sem Base 02...
--   com os que estao em manutencao ou fora de uso ao final.
-- - Notebook Ultra recebe Sem Base depois de todos os notebooks comuns.
-- - O grupo do dispositivo nao e alterado; somente o numero contador.

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

WITH healthy_notebooks AS (
    SELECT
        id,
        lower(COALESCE(btrim("group"), '')) AS normalized_group,
        COALESCE(patrimony, '') AS patrimony
    FROM public.devices
    WHERE type = 'Notebook'
      AND lower(COALESCE(status, '')) NOT LIKE 'manuten%'
      AND lower(COALESCE(status, '')) <> 'fora de uso'
),
base_1_candidates AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            ORDER BY
                CASE
                    WHEN normalized_group IN ('base 1', 'base 01') THEN 0
                    WHEN normalized_group IN ('base 2', 'base 02') THEN 2
                    ELSE 1
                END,
                patrimony,
                id
        ) AS position
    FROM healthy_notebooks
),
base_1 AS (
    SELECT
        id,
        format('Base 01 Notebook %s', lpad(position::text, 2, '0')) AS new_counter_number
    FROM base_1_candidates
    WHERE position <= 40
),
base_2_candidates AS (
    SELECT
        healthy_notebooks.id,
        ROW_NUMBER() OVER (
            ORDER BY
                CASE
                    WHEN normalized_group IN ('base 2', 'base 02') THEN 0
                    ELSE 1
                END,
                patrimony,
                healthy_notebooks.id
        ) AS position
    FROM healthy_notebooks
    WHERE NOT EXISTS (SELECT 1 FROM base_1 WHERE base_1.id = healthy_notebooks.id)
),
base_2 AS (
    SELECT
        id,
        format('Base 02 Notebook %s', lpad(position::text, 2, '0')) AS new_counter_number
    FROM base_2_candidates
    WHERE position <= 40
),
remaining_notebooks AS (
    SELECT
        d.id,
        ROW_NUMBER() OVER (
            ORDER BY
                CASE
                    WHEN lower(COALESCE(d.status, '')) LIKE 'manuten%'
                      OR lower(COALESCE(d.status, '')) = 'fora de uso' THEN 1
                    ELSE 0
                END,
                COALESCE(btrim(d."group"), ''),
                COALESCE(d.patrimony, ''),
                d.id
        ) AS position
    FROM public.devices AS d
    WHERE d.type = 'Notebook'
      AND NOT EXISTS (SELECT 1 FROM base_1 WHERE base_1.id = d.id)
      AND NOT EXISTS (SELECT 1 FROM base_2 WHERE base_2.id = d.id)
),
sem_base_notebooks AS (
    SELECT
        id,
        format('Sem Base %s', lpad(position::text, 2, '0')) AS new_counter_number
    FROM remaining_notebooks
),
ultras AS (
    SELECT
        d.id,
        (SELECT COUNT(*) FROM remaining_notebooks)
        + ROW_NUMBER() OVER (
            ORDER BY
                CASE
                    WHEN lower(COALESCE(d.status, '')) LIKE 'manuten%'
                      OR lower(COALESCE(d.status, '')) = 'fora de uso' THEN 1
                    ELSE 0
                END,
                COALESCE(d.patrimony, ''),
                d.id
        ) AS position
    FROM public.devices AS d
    WHERE d.type = 'Notebook Ultra'
),
new_counters AS (
    SELECT id, new_counter_number FROM base_1
    UNION ALL
    SELECT id, new_counter_number FROM base_2
    UNION ALL
    SELECT id, new_counter_number FROM sem_base_notebooks
    UNION ALL
    SELECT id, format('Sem Base %s', lpad(position::text, 2, '0')) FROM ultras
)
UPDATE public.devices AS d
SET counter_number = new_counters.new_counter_number
FROM new_counters
WHERE d.id = new_counters.id;

-- Conferencia final. Positivos novos devem aparecer com zero alteracoes.
SELECT
    type,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE counter_number LIKE 'Base 01 Notebook %') AS base_01,
    COUNT(*) FILTER (WHERE counter_number LIKE 'Base 02 Notebook %') AS base_02,
    COUNT(*) FILTER (WHERE counter_number LIKE 'Sem Base %') AS sem_base
FROM public.devices
WHERE type IN ('Notebook', 'Notebook Ultra', 'Notebook Positivo (Novos)')
GROUP BY type
ORDER BY type;

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
