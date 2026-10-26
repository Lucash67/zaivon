-- Razão de cofrinho independente de dia operacional.
-- Reversão: as tabelas só devem ser removidas se não houver lançamento posted.
--   DROP TABLE IF EXISTS public.vault_movement_revisions;
--   DROP TABLE IF EXISTS public.vault_movements;
--   DROP TABLE IF EXISTS public.vault_accounts;

CREATE TABLE IF NOT EXISTS public.vault_accounts (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses (id),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_accounts_business_slug_unique UNIQUE (business_id, slug)
);

CREATE TABLE IF NOT EXISTS public.vault_movements (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses (id),
  account_id uuid NOT NULL REFERENCES public.vault_accounts (id),
  counter_account_id uuid REFERENCES public.vault_accounts (id),
  movement_type text NOT NULL,
  effect text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  effective_date date NOT NULL,
  competence_date date,
  description text NOT NULL,
  source_label text,
  operation_day_id uuid REFERENCES public.operation_days (id),
  sale_id uuid REFERENCES public.sales (id),
  external_id text,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'posted',
  reverses_movement_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_movements_business_idempotency_unique UNIQUE (business_id, idempotency_key),
  CONSTRAINT vault_movements_type_check CHECK (
    movement_type IN (
      'deposit', 'withdrawal', 'transfer', 'adjustment', 'yield', 'reversal', 'reclassification', 'opening_balance'
    )
  ),
  CONSTRAINT vault_movements_effect_check CHECK (effect IN ('credit', 'debit')),
  CONSTRAINT vault_movements_status_check CHECK (status IN ('posted', 'reversed')),
  CONSTRAINT vault_movements_amount_check CHECK (amount > 0),
  CONSTRAINT vault_movements_transfer_check CHECK (movement_type <> 'transfer' OR counter_account_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_vault_movements_account_date
  ON public.vault_movements (account_id, effective_date);

CREATE TABLE IF NOT EXISTS public.vault_movement_revisions (
  id uuid PRIMARY KEY,
  movement_id uuid NOT NULL REFERENCES public.vault_movements (id),
  before jsonb,
  after jsonb NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_movement_revisions_movement
  ON public.vault_movement_revisions (movement_id, created_at);

ALTER TABLE public.vault_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_movement_revisions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.vault_accounts FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON TABLE public.vault_movements FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON TABLE public.vault_movement_revisions FROM anon, authenticated';
  END IF;
END $$;
