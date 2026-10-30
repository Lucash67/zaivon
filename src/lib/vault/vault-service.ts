import { asc, eq } from "drizzle-orm";
import { vaultAccounts, vaultMovements } from "@/lib/db/postgres/schema";
import { getPostgresDb } from "@/platform/db";
import { toDbBusinessId } from "@/platform/db/business-id";
import { queryAll } from "@/platform/db/query";
import { centsToMoney, foldVaultCents, moneyToCents, movementCents, type VaultFoldRow } from "@/lib/vault/balance";
import { informedGapParts, readInformedBalance, readResponsiblePayment, roundMoney } from "@/lib/vault/informed-balance";
import type { VaultSnapshot } from "@/lib/zaivon/types";

const ACCOUNT_SLUG = "salgados-e-sanduiches";

export async function loadVaultSnapshot(businessSlug: string): Promise<VaultSnapshot> {
  const empty: VaultSnapshot = {
    accountName: "Salgados e Sanduíches",
    balance: 0,
    asOf: null,
    informedBalance: null,
    reconciliationGap: null,
    gapParts: [],
    movements: [],
  };
  const db = await getPostgresDb();
  const businessId = toDbBusinessId(businessSlug);
  try {
    const accounts = await queryAll(
      db
        .select({ id: vaultAccounts.id, name: vaultAccounts.name })
        .from(vaultAccounts)
        .where(eq(vaultAccounts.businessId, businessId)),
    );
    const account = accounts.find((item) => item.name === "Salgados e Sanduíches");
    if (!account) return empty;
    const rows = await queryAll(
      db
        .select({
          id: vaultMovements.id,
          type: vaultMovements.movementType,
          effect: vaultMovements.effect,
          amount: vaultMovements.amount,
          date: vaultMovements.effectiveDate,
          description: vaultMovements.description,
          status: vaultMovements.status,
          key: vaultMovements.idempotencyKey,
          metadata: vaultMovements.metadata,
        })
        .from(vaultMovements)
        .where(eq(vaultMovements.accountId, account.id))
        .orderBy(asc(vaultMovements.effectiveDate), asc(vaultMovements.createdAt)),
    );
    if (rows.length === 0) return { ...empty, accountName: account.name };
    const foldRows: VaultFoldRow[] = rows.map((row) => ({
      idempotencyKey: row.key,
      type: row.type,
      effect: row.effect,
      amountCents: moneyToCents(Number(row.amount)),
      status: row.status,
      effectiveDate: row.date,
    }));
    let running = 0;
    const movements = rows.map((row, index) => {
      running += movementCents(foldRows[index]!);
      return {
        id: row.id,
        date: row.date,
        type: row.type,
        effect: row.effect,
        amount: Number(row.amount),
        description: row.description,
        balanceAfter: centsToMoney(running),
        informedBalance: readInformedBalance(row.metadata),
        responsiblePayment: readResponsiblePayment(row.metadata),
      };
    });
    const balance = centsToMoney(foldVaultCents(foldRows));
    const asOf = [...rows].reverse().find((row) => row.status === "posted" && row.type !== "reversal")?.date ?? null;
    const informedBalance = [...movements].reverse().find((row) => row.informedBalance != null)?.informedBalance ?? null;
    const reconciliationGap = informedBalance == null ? null : roundMoney(informedBalance - balance);
    const gapParts = informedGapParts(movements.map((row) => ({
      date: row.date,
      bookAfter: row.balanceAfter,
      informed: row.informedBalance ?? null,
    })));
    return { accountName: account.name, balance, asOf, informedBalance, reconciliationGap, gapParts, movements };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/vault_movements|vault_accounts/.test(message)) return empty;
    throw error;
  }
}

export { ACCOUNT_SLUG };
