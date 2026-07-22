-- Renumera os numeros contador dos notebooks que serao impressos.
--
-- Escopo usado:
-- - type = 'Notebook'
-- - status diferente de 'Fora de uso'
--
-- A ordem preserva a sequencia atual quando o contador ja tem numero,
-- desempata por patrimonio e id, e coloca itens sem numero no final.
-- Depois da execucao, os notebooks ficam como 001, 002, 003... sem repetir e sem pular.

BEGIN;

-- Conferencia antes de alterar.
WITH target AS (
    SELECT
        id,
        type,
        patrimony,
        serial_number,
        counter_number,
        "group",
        status,
        NULLIF(regexp_replace(COALESCE(counter_number, ''), '\D', '', 'g'), '')::INT AS current_counter_number
    FROM public.devices
    WHERE type = 'Notebook'
      AND status <> 'Fora de uso'
),
ordered AS (
    SELECT
        *,
        LPAD(
            ROW_NUMBER() OVER (
                ORDER BY
                    CASE WHEN current_counter_number IS NULL THEN 1 ELSE 0 END,
                    current_counter_number,
                    COALESCE(patrimony, ''),
                    id
            )::TEXT,
            3,
            '0'
        ) AS new_counter_number
    FROM target
)
SELECT
    new_counter_number AS novo_numero_contador,
    counter_number AS numero_atual,
    id,
    patrimony AS patrimonio,
    serial_number AS numero_serie,
    "group" AS agrupamento,
    status
FROM ordered
ORDER BY new_counter_number;

-- Atualizacao.
WITH target AS (
    SELECT
        id,
        patrimony,
        NULLIF(regexp_replace(COALESCE(counter_number, ''), '\D', '', 'g'), '')::INT AS current_counter_number
    FROM public.devices
    WHERE type = 'Notebook'
      AND status <> 'Fora de uso'
),
ordered AS (
    SELECT
        id,
        LPAD(
            ROW_NUMBER() OVER (
                ORDER BY
                    CASE WHEN current_counter_number IS NULL THEN 1 ELSE 0 END,
                    current_counter_number,
                    COALESCE(patrimony, ''),
                    id
            )::TEXT,
            3,
            '0'
        ) AS new_counter_number
    FROM target
)
UPDATE public.devices AS d
SET counter_number = ordered.new_counter_number
FROM ordered
WHERE d.id = ordered.id;

-- Conferencia depois de alterar.
WITH target AS (
    SELECT
        id,
        counter_number,
        NULLIF(regexp_replace(COALESCE(counter_number, ''), '\D', '', 'g'), '')::INT AS counter_as_int
    FROM public.devices
    WHERE type = 'Notebook'
      AND status <> 'Fora de uso'
),
summary AS (
    SELECT
        COUNT(*) AS total_notebooks,
        COUNT(DISTINCT counter_number) AS total_numeros_unicos,
        MIN(counter_as_int) AS primeiro_numero,
        MAX(counter_as_int) AS ultimo_numero
    FROM target
)
SELECT
    total_notebooks,
    total_numeros_unicos,
    primeiro_numero,
    ultimo_numero,
    CASE
        WHEN total_notebooks = total_numeros_unicos
         AND primeiro_numero = 1
         AND ultimo_numero = total_notebooks
        THEN 'OK - sem repeticao e sem faltas'
        ELSE 'VERIFICAR - ainda ha repeticao ou falta'
    END AS resultado
FROM summary;

COMMIT;
