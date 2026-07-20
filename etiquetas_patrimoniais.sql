-- Campos usados no módulo de etiquetas patrimoniais
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS model TEXT,
ADD COLUMN IF NOT EXISTS school_name TEXT DEFAULT 'Escola Percio';

UPDATE devices
SET school_name = COALESCE(NULLIF(btrim(school_name), ''), 'Escola Percio');
