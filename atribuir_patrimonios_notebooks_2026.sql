-- Atribui um novo patrimonio a TODOS os notebooks, inclusive aos que ainda
-- nao possuem patrimonio.
--
-- Tipos incluidos: qualquer tipo iniciado por "Notebook" (por exemplo,
-- Notebook, Notebook Positivo (Novos) e Notebook Ultra).
--
-- Formato gerado: 2026.000.000.00, 2026.000.001.00 ...
-- A numeracao nao repete valores ja usados por equipamentos que nao sao
-- notebooks. Execute este arquivo no SQL Editor do Supabase.

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

-- Monta a relacao id -> novo patrimonio. A ordenacao e deterministica para
-- que a conferencia antes da atualizacao mostre exatamente o resultado final.
CREATE TEMP TABLE _new_notebook_patrimonies ON COMMIT DROP AS
WITH target AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            ORDER BY type, COALESCE(NULLIF(btrim(patrimony), ''), ''), id
        ) AS target_position
    FROM public.devices
    WHERE type ILIKE 'Notebook%'
),
other_patrimonies AS (
    SELECT DISTINCT btrim(patrimony) AS patrimony
    FROM public.devices
    WHERE type NOT ILIKE 'Notebook%'
      AND NULLIF(btrim(patrimony), '') IS NOT NULL
),
candidate_numbers AS (
    -- Ha candidatos suficientes mesmo quando equipamentos de outro tipo ja
    -- usam numeros no padrao de 2026.
    SELECT n
    FROM generate_series(
        0,
        (SELECT COUNT(*) FROM target) + (SELECT COUNT(*) FROM other_patrimonies) - 1
    ) AS n
),
available_patrimonies AS (
    SELECT
        n,
        format('2026.%s.%s.00', lpad((n / 1000)::text, 3, '0'), lpad((n % 1000)::text, 3, '0')) AS patrimony,
        ROW_NUMBER() OVER (ORDER BY n) AS available_position
    FROM candidate_numbers
    WHERE format('2026.%s.%s.00', lpad((n / 1000)::text, 3, '0'), lpad((n % 1000)::text, 3, '0'))
          NOT IN (SELECT patrimony FROM other_patrimonies)
)
SELECT target.id, available_patrimonies.patrimony AS new_patrimony
FROM target
JOIN available_patrimonies
  ON available_patrimonies.available_position = target.target_position;

-- Conferencia antes de gravar.
SELECT d.id, d.type, d.patrimony AS patrimonio_atual, m.new_patrimony AS novo_patrimonio
FROM _new_notebook_patrimonies AS m
JOIN public.devices AS d ON d.id = m.id
ORDER BY m.new_patrimony;

-- Etapa temporaria: permite a troca mesmo se houver uma restricao UNIQUE no
-- campo patrimonio, sem conflitar com os valores atuais dos notebooks.
UPDATE public.devices AS d
SET patrimony = format('__tmp_patrimony_%s_%s__', txid_current(), d.id)
FROM _new_notebook_patrimonies AS m
WHERE d.id = m.id;

UPDATE public.devices AS d
SET patrimony = m.new_patrimony
FROM _new_notebook_patrimonies AS m
WHERE d.id = m.id;

-- Resultado final: deve informar que todos os notebooks receberam numeros
-- diferentes e que nao ha colisao com os outros tipos de equipamento.
SELECT
    COUNT(*) AS total_notebooks,
    COUNT(DISTINCT d.patrimony) AS patrimonios_unicos_notebooks,
    MIN(d.patrimony) AS primeiro_patrimonio,
    MAX(d.patrimony) AS ultimo_patrimonio,
    CASE
        WHEN COUNT(*) = COUNT(DISTINCT d.patrimony)
         AND COUNT(*) = (SELECT COUNT(*) FROM _new_notebook_patrimonies)
        THEN 'OK - todos os notebooks receberam patrimonio unico'
        ELSE 'VERIFICAR - ha patrimonio ausente ou repetido'
    END AS resultado
FROM public.devices AS d
WHERE d.type ILIKE 'Notebook%';

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
