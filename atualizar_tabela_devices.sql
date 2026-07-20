DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'devices'
          AND column_name = 'serial_number'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'devices'
          AND column_name = 'counter_number'
    ) THEN
        ALTER TABLE devices RENAME COLUMN serial_number TO counter_number;
    END IF;
END $$;

ALTER TABLE devices
ADD COLUMN IF NOT EXISTS serial_number TEXT,
ADD COLUMN IF NOT EXISTS counter_number TEXT,
ADD COLUMN IF NOT EXISTS imei TEXT,
ADD COLUMN IF NOT EXISTS observations TEXT;

UPDATE devices
SET counter_number = COALESCE(NULLIF(btrim(counter_number), ''), 's/n');

ALTER TABLE devices
ALTER COLUMN counter_number SET DEFAULT 's/n',
ALTER COLUMN counter_number SET NOT NULL;
