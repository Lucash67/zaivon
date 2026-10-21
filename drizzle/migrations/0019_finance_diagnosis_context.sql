ALTER TABLE finance.profiles
  ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '{}'::jsonb;
