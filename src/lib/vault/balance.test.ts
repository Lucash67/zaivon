import assert from "node:assert/strict";
import { effectFor, foldVaultCents, type VaultFoldRow } from "./balance";

function row(partial: Partial<VaultFoldRow> & Pick<VaultFoldRow, "idempotencyKey" | "type" | "amountCents">): VaultFoldRow {
  return {
    effect: effectFor(partial.type, partial.effect === "debit" ? "out" : "in"),
    status: "posted",
    effectiveDate: "2026-10-24",
    ...partial,
  };
}

const opening: VaultFoldRow = {
  idempotencyKey: "opening",
  type: "opening_balance",
  effect: "credit",
  amountCents: 534608,
  status: "posted",
  effectiveDate: "2026-10-22",
};
const deposit: VaultFoldRow = {
  idempotencyKey: "zaivon-2026-10-24-deposito-248",
  type: "deposit",
  effect: "credit",
  amountCents: 24800,
  status: "posted",
  effectiveDate: "2026-10-24",
};

assert.equal(foldVaultCents([opening, deposit]), 559408);
assert.notEqual(24800, 19200);

assert.equal(
  foldVaultCents([
    opening,
    deposit,
    row({ idempotencyKey: "saque", type: "withdrawal", amountCents: 1000, effect: "debit" }),
  ]),
  558408,
);

assert.equal(
  foldVaultCents([
    opening,
    row({ idempotencyKey: "rendimento", type: "yield", amountCents: 50, effect: "credit" }),
  ]),
  534658,
);

assert.equal(
  foldVaultCents([
    { ...opening, idempotencyKey: "conta-a" },
    row({ idempotencyKey: "transf-entrada", type: "transfer", amountCents: 4000, effect: effectFor("transfer", "in") }),
  ]),
  538608,
);
assert.equal(
  foldVaultCents([
    row({ idempotencyKey: "transf-saida", type: "transfer", amountCents: 4000, effect: effectFor("transfer", "out"), effectiveDate: "2026-10-24" }),
  ]),
  -4000,
);

const reversed = foldVaultCents([
  opening,
  { ...deposit, status: "reversed" },
  row({ idempotencyKey: "estorno-248", type: "reversal", amountCents: 24800, effect: "debit" }),
]);
assert.equal(reversed, 534608);

assert.throws(() => foldVaultCents([deposit, deposit]), /duplicada/);

console.log("VAULT_BALANCE_OK");
