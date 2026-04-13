-- Migration 002: Add missing schema objects from Tasks #4 and #5
-- Applied: 2026-04-13
-- Reason: drizzle-kit push aborted on post-merge due to interactive sessions
--         table prompt; these DDL statements apply the missing changes directly.

-- Task #4: Add start_date column to debts table (nullable date)
ALTER TABLE debts ADD COLUMN IF NOT EXISTS start_date date;

-- Task #5: Create asset_entries table for Net Worth asset category tracking
CREATE TABLE IF NOT EXISTS asset_entries (
  id           text        PRIMARY KEY,
  user_id      text        NOT NULL,
  category     text        NOT NULL,
  name         text        NOT NULL,
  value        numeric(14, 2) NOT NULL,
  month        text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Verification queries (run after applying):
-- SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'debts' AND column_name = 'start_date';
-- Expected: 1 row, data_type = date

-- SELECT table_name FROM information_schema.tables
--   WHERE table_name = 'asset_entries';
-- Expected: 1 row

-- SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'asset_entries'
--   ORDER BY ordinal_position;
-- Expected: 8 rows (id, user_id, category, name, value, month, created_at, updated_at)
