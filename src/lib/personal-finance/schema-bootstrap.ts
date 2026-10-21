import postgres from "postgres";
import { getDatabaseUrl } from "@/platform/db/config";

const STATEMENTS = [
  "CREATE SCHEMA IF NOT EXISTS finance",
  `CREATE TABLE IF NOT EXISTS finance.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    display_name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BRL',
    timezone TEXT NOT NULL DEFAULT 'America/Fortaleza',
    monthly_income NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payday INTEGER NOT NULL DEFAULT 5,
    onboarding_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_profiles_user ON finance.profiles (user_id)`,
  `CREATE TABLE IF NOT EXISTS finance.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES finance.profiles (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'checking',
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#E8B86D',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fin_accounts_profile ON finance.accounts (profile_id)`,
  `CREATE TABLE IF NOT EXISTS finance.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES finance.profiles (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    group_name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'wallet',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fin_categories_profile ON finance.categories (profile_id)`,
  `CREATE TABLE IF NOT EXISTS finance.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES finance.profiles (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC(14, 2) NOT NULL,
    current_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    deadline DATE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fin_goals_profile ON finance.goals (profile_id)`,
  `CREATE TABLE IF NOT EXISTS finance.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES finance.profiles (id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES finance.accounts (id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES finance.categories (id) ON DELETE RESTRICT,
    goal_id UUID REFERENCES finance.goals (id) ON DELETE SET NULL,
    direction TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    occurred_on DATE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fin_tx_profile_date ON finance.transactions (profile_id, occurred_on)`,
  `CREATE TABLE IF NOT EXISTS finance.recurring_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES finance.profiles (id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES finance.accounts (id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES finance.categories (id) ON DELETE RESTRICT,
    direction TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    name TEXT NOT NULL,
    cadence TEXT NOT NULL DEFAULT 'monthly',
    day_of_month INTEGER NOT NULL DEFAULT 1,
    next_on DATE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fin_recurring_profile ON finance.recurring_rules (profile_id)`,
  `CREATE TABLE IF NOT EXISTS finance.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES finance.profiles (id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES finance.categories (id) ON DELETE CASCADE,
    year_month TEXT NOT NULL,
    limit_amount NUMERIC(14, 2) NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_budgets_uniq ON finance.budgets (profile_id, category_id, year_month)`,
  `CREATE TABLE IF NOT EXISTS finance.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES finance.profiles (id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    target_amount NUMERIC(14, 2) NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fin_challenges_profile ON finance.challenges (profile_id, code)`,
  `CREATE TABLE IF NOT EXISTS finance.month_spend_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES finance.profiles (id) ON DELETE CASCADE,
    year_month TEXT NOT NULL,
    target_amount NUMERIC(14, 2) NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_month_spend_uniq ON finance.month_spend_targets (profile_id, year_month)`,
  `CREATE TABLE IF NOT EXISTS finance.week_spends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES finance.profiles (id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    amount NUMERIC(14, 2) NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_week_spends_uniq ON finance.week_spends (profile_id, week_start)`,
];

let ready: Promise<void> | null = null;

/** Cria o schema na primeira abertura do produto. Idempotente. */
export function ensureFinanceSchema(): Promise<void> {
  if (!ready) {
    ready = apply().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

async function apply(): Promise<void> {
  const sql = postgres(getDatabaseUrl(), { prepare: false, max: 1 });
  try {
    const found = await sql`
      SELECT 1 AS ok
      FROM information_schema.tables
      WHERE table_schema = 'finance' AND table_name = 'week_spends'
      LIMIT 1
    `;
    if (found.length > 0) return;
    for (const statement of STATEMENTS) {
      await sql.unsafe(statement);
    }
  } finally {
    await sql.end({ timeout: 2 });
  }
}
