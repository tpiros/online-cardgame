/*
  # Add number_request column to tables

  Adds `number_request` (text, nullable) to support King card number-request mechanic.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tables' AND column_name = 'number_request'
  ) THEN
    ALTER TABLE tables ADD COLUMN number_request text DEFAULT NULL;
  END IF;
END $$;
