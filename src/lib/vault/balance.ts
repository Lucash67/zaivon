export const VAULT_MOVEMENT_TYPES = [
  "deposit",
  "withdrawal",
  "transfer",
  "adjustment",
  "yield",
  "reversal",
  "reclassification",
  "opening_balance",
] as const;

export type VaultMovementType = (typeof VAULT_MOVEMENT_TYPES)[number];
export type VaultEffect = "credit" | "debit";
export type VaultStatus = "posted" | "reversed";

export interface VaultFoldRow {
  idempotencyKey: string;
  type: VaultMovementType;
  effect: VaultEffect;
  amountCents: number;
  status: VaultStatus;
  effectiveDate: string;
}

export function effectFor(type: VaultMovementType, direction?: "in" | "out"): VaultEffect {
  if (type === "deposit" || type === "yield" || type === "opening_balance") return "credit";
  if (type === "withdrawal") return "debit";
  if (type === "reversal") return direction === "out" ? "debit" : "credit";
  if (!direction) throw new Error("Transferência, ajuste e reclassificação precisam de direção.");
  return direction === "in" ? "credit" : "debit";
}

/** Centavos com sinal. Estorno e lançamento revertido ficam fora do saldo. */
export function movementCents(row: VaultFoldRow): number {
  if (row.status !== "posted" || row.type === "reversal") return 0;
  if (!Number.isInteger(row.amountCents) || row.amountCents <= 0) {
    throw new Error(`Valor inválido em ${row.idempotencyKey}`);
  }
  return row.effect === "credit" ? row.amountCents : -row.amountCents;
}

export function foldVaultCents(rows: VaultFoldRow[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const row of rows) {
    if (seen.has(row.idempotencyKey)) throw new Error(`Movimentação duplicada: ${row.idempotencyKey}`);
    seen.add(row.idempotencyKey);
    total += movementCents(row);
  }
  return total;
}

export function centsToMoney(cents: number): number {
  return Math.round(cents) / 100;
}

export function moneyToCents(amount: number): number {
  return Math.round(amount * 100);
}
