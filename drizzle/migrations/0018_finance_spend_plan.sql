-- Projeção de gasto semanal do ZAIVON Finance.
-- Espelho do trecho novo em schema-bootstrap.ts

CREATE TABLE IF NOT EXISTS finance.month_spend_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES finance.profiles (id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  target_amount NUMERIC(14, 2) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_month_spend_uniq
  ON finance.month_spend_targets (profile_id, year_month);

CREATE TABLE IF NOT EXISTS finance.week_spends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES finance.profiles (id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  amount NUMERIC(14, 2) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_week_spends_uniq
  ON finance.week_spends (profile_id, week_start);
