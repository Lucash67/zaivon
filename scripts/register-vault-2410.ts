/**
 * Razão do cofrinho e depósito de 24/10/2026.
 * Não cria dia operacional, não altera fechamentos e não duplica o depósito.
 */
import "./load-env";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { and, eq, sql } from "drizzle-orm";
import { appSettings, diaryEntries, operationDays, products, sales, vaultAccounts, vaultMovementRevisions, vaultMovements } from "../src/lib/db/postgres/schema";
import { centsToMoney, foldVaultCents, moneyToCents } from "../src/lib/vault/balance";
import { getDatabaseUrl } from "../src/platform/db/config";
import { closePostgresConnection, getPostgresDb, runPostgresTransaction } from "../src/platform/db/postgres/client";
import { generateId } from "../src/shared/ids/generate-id";

const BIZ = "00000000-0000-4000-8000-000000000001";
const DAY23 = "5a01e14c-a605-43a1-8cb0-7c7c2de260d1";
const META_KEY = "omni_v2_meta_salgados";
const PRACTICAL_KEY = "profit_bank_practical_salgados";
const OPENING_KEY = "zaivon-vault-opening-salgados-2026-10-22";
const DEPOSIT_KEY = "zaivon-2026-10-24-deposito-248";
const SNAPSHOT = "C:/Users/lucas/AppData/Local/Temp/zaivon-vault-2410/snapshot-before.json";

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.009;
}

async function main() {
  const db = await getPostgresDb();
  const snapshot = await takeSnapshot(db);
  mkdirSync("C:/Users/lucas/AppData/Local/Temp/zaivon-vault-2410", { recursive: true });
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot));

  const sqlClient = postgres(getDatabaseUrl(), { prepare: false, max: 1 });
  await sqlClient.unsafe(readFileSync("drizzle/migrations/0021_vault_movements.sql", "utf8"));
  await sqlClient.end();

  const existing = await db
    .select({ key: vaultMovements.idempotencyKey })
    .from(vaultMovements)
    .where(eq(vaultMovements.businessId, BIZ));
  const keys = new Set(existing.map((row) => row.key));
  if (keys.has(OPENING_KEY) && keys.has(DEPOSIT_KEY)) {
    await verify(db);
    console.log("ZERO_NEW");
    await closePostgresConnection();
    return;
  }

  await runPostgresTransaction(async (tx) => {
    await assertProtected(tx);
    const accounts = await tx.select({ id: vaultAccounts.id }).from(vaultAccounts).where(and(eq(vaultAccounts.businessId, BIZ), eq(vaultAccounts.slug, "salgados-e-sanduiches")));
    const accountId = accounts[0]?.id ?? generateId();
    const now = new Date();
    if (!accounts[0]) {
      await tx.insert(vaultAccounts).values({
        id: accountId,
        businessId: BIZ,
        name: "Salgados e Sanduíches",
        slug: "salgados-e-sanduiches",
        createdAt: now,
      });
    }
    const created: string[] = [];
    const post = async (input: {
      key: string;
      type: "opening_balance" | "deposit";
      amount: string;
      date: string;
      description: string;
      source: string;
      metadata: Record<string, unknown>;
    }) => {
      if (keys.has(input.key)) return;
      const id = generateId();
      const row = {
        id,
        businessId: BIZ,
        accountId,
        movementType: input.type,
        effect: "credit" as const,
        amount: input.amount,
        effectiveDate: input.date,
        description: input.description,
        sourceLabel: input.source,
        idempotencyKey: input.key,
        status: "posted" as const,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      };
      await tx.insert(vaultMovements).values(row);
      await tx.insert(vaultMovementRevisions).values({
        id: generateId(),
        movementId: id,
        before: null,
        after: row,
        reason: "criacao",
        createdAt: now,
      });
      created.push(id);
    };
    await post({
      key: OPENING_KEY,
      type: "opening_balance",
      amount: "5346.08",
      date: "2026-10-22",
      description: "Saldo confirmado de R$ 5346,08 ao fim de 22/10, preservado no fechamento de 23/10. Não é depósito novo. Os depósitos anteriores já estão neste saldo.",
      source: "cofrinho confirmado de 22/10",
      metadata: {
        classification: "saldo_confirmado_preexistente",
        revenue: false,
        source: "app_settings.omni_v2_meta_salgados.cofrinho.2026-10-22",
        confirmedBalance: 5346.08,
        alsoPreservedOn: "2026-10-23",
      },
    });
    await post({
      key: DEPOSIT_KEY,
      type: "deposit",
      amount: "248.00",
      date: "2026-10-24",
      description: "Depósito efetivo de R$ 248 no cofrinho Salgados e Sanduíches. Referência gerencial da conciliação de 23/10. Não é o lucro daquele dia. A transferência não operacional de R$ 40 do Henrique já está contida neste valor.",
      source: "depósito confirmado pelo proprietário",
      metadata: {
        classification: "deposito_efetivo",
        revenue: false,
        profit: false,
        destination: "Salgados e Sanduíches",
        managerialReferenceDate: "2026-10-23",
        previousBalance: 5346.08,
        informedBalance: 5594.08,
        migratedFrom: "pendingPiggyTransfers:zaivon-2026-10-24-deposito-248",
        includesNonOperational: [{ who: "Henrique", amount: 40, date: "2026-10-24", note: "Já contido nos R$ 248. Não somar de novo." }],
      },
    });

    const rows = await tx.select({
      key: vaultMovements.idempotencyKey,
      type: vaultMovements.movementType,
      effect: vaultMovements.effect,
      amount: vaultMovements.amount,
      status: vaultMovements.status,
      date: vaultMovements.effectiveDate,
    }).from(vaultMovements).where(eq(vaultMovements.accountId, accountId));
    const balance = centsToMoney(foldVaultCents(rows.map((row) => ({
      idempotencyKey: row.key,
      type: row.type,
      effect: row.effect,
      amountCents: moneyToCents(Number(row.amount)),
      status: row.status,
      effectiveDate: row.date,
    }))));
    if (!near(balance, 5594.08)) throw new Error(`Saldo do razão ${balance}`);

    await tx.insert(appSettings).values({ key: PRACTICAL_KEY, value: 5594.08, updatedAt: now }).onConflictDoUpdate({
      target: appSettings.key,
      set: { value: 5594.08, updatedAt: now },
    });

    const metaRow = await tx.select().from(appSettings).where(eq(appSettings.key, META_KEY));
    const current = metaRow[0]?.value as {
      cofrinho?: Record<string, number>;
      pendingPiggyTransfers?: Array<Record<string, unknown>>;
    };
    if (!near(current.cofrinho?.["2026-10-22"] ?? 0, 5346.08) || !near(current.cofrinho?.["2026-10-21"] ?? 0, 5212.02)) {
      throw new Error("Cofrinho histórico divergente");
    }
    if (current.cofrinho?.["2026-10-23"] != null || current.cofrinho?.["2026-10-24"] != null) {
      throw new Error("O mapa diário recebeu saldo de 23/10 ou 24/10");
    }
    const transfers = (current.pendingPiggyTransfers ?? []).map((item) =>
      item.id === DEPOSIT_KEY ? { ...item, ledgerPosted: true, ledgerIdempotencyKey: DEPOSIT_KEY } : item,
    );
    await tx.update(appSettings).set({
      value: { ...current, pendingPiggyTransfers: transfers },
      updatedAt: now,
    }).where(eq(appSettings.key, META_KEY));
    await assertProtected(tx);
    console.log(JSON.stringify({ created: created.length }));
  });

  await verify(db);
  await expectDuplicate(db);
  console.log("VERIFY_OK");
  await closePostgresConnection();
}

async function assertProtected(db: Awaited<ReturnType<typeof getPostgresDb>>) {
  const day22 = await db.select({ received: diaryEntries.revenueReceived, total: diaryEntries.revenueTotal, profit: diaryEntries.operationalProfit, status: operationDays.status }).from(diaryEntries).innerJoin(operationDays, eq(operationDays.id, diaryEntries.operationDayId)).where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, "2026-10-22")));
  if (!near(Number(day22[0]?.received), 164) || !near(Number(day22[0]?.total), 188) || !near(Number(day22[0]?.profit), 104) || day22[0]?.status !== "closed") {
    throw new Error("22/10 alterado");
  }
  const day23 = await db.select({
    received: diaryEntries.revenueReceived,
    total: diaryEntries.revenueTotal,
    profit: diaryEntries.operationalProfit,
    narrative: diaryEntries.narrative,
    observations: diaryEntries.observations,
    status: operationDays.status,
  }).from(diaryEntries).innerJoin(operationDays, eq(operationDays.id, diaryEntries.operationDayId)).where(eq(operationDays.id, DAY23));
  const narrative = day23[0]?.narrative as { bonusIncome?: number; dayClosing?: { competenceProfit?: number; cash?: { cashIn?: number }; costs?: { ownCost?: number }; piggyBank?: { deposit?: number; closingBalance?: number } } };
  if (day23[0]?.status !== "closed" || !near(Number(day23[0]?.received), 195) || !near(Number(day23[0]?.total), 192) || !near(Number(day23[0]?.profit), 195)) {
    throw new Error("23/10 alterado");
  }
  if (narrative.bonusIncome !== 0 || !near(narrative.dayClosing?.competenceProfit ?? 0, 192) || !near(narrative.dayClosing?.cash?.cashIn ?? 0, 195) || !near(narrative.dayClosing?.costs?.ownCost ?? 1, 0)) {
    throw new Error("Indicadores de 23/10 alterados");
  }
  if (!near(narrative.dayClosing?.piggyBank?.deposit ?? 1, 0) || !near(narrative.dayClosing?.piggyBank?.closingBalance ?? 0, 5346.08)) {
    throw new Error("Cofrinho do fechamento de 23/10 alterado");
  }
  const notes = day23[0]?.observations ?? "";
  if (!notes.includes("R01") || !notes.includes("R04")) throw new Error("Ressalvas de 23/10 alteradas");
}

async function takeSnapshot(db: Awaited<ReturnType<typeof getPostgresDb>>) {
  await assertProtected(db);
  const meta = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, META_KEY));
  const practical = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, PRACTICAL_KEY));
  const day26 = await db.select({ id: operationDays.id }).from(operationDays).where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, "2026-10-26")));
  const stock = await db.select({ stock: products.stockQuantity }).from(products).where(eq(products.name, "Mistão Frito"));
  const sales23 = await db.select({ id: sales.id }).from(sales).where(eq(sales.operationDayId, DAY23));
  if (sales23.length !== 27 || stock[0]?.stock !== 525 || day26.length !== 0) {
    throw new Error("Estado protegido divergente antes da escrita");
  }
  return { takenAt: new Date().toISOString(), meta: meta[0]?.value ?? null, practical: practical[0]?.value ?? null, sales23: sales23.length };
}

async function verify(db: Awaited<ReturnType<typeof getPostgresDb>>) {
  await assertProtected(db);
  const rows = await db.select({
    key: vaultMovements.idempotencyKey,
    type: vaultMovements.movementType,
    effect: vaultMovements.effect,
    amount: vaultMovements.amount,
    status: vaultMovements.status,
    date: vaultMovements.effectiveDate,
    dayId: vaultMovements.operationDayId,
  }).from(vaultMovements).where(eq(vaultMovements.businessId, BIZ));
  if (rows.length !== 2) throw new Error(`Movimentações ${rows.length}`);
  const deposit = rows.find((row) => row.key === DEPOSIT_KEY);
  if (deposit?.date !== "2026-10-24" || Number(deposit.amount) !== 248 || deposit.dayId != null) throw new Error("Depósito divergente");
  const balance = centsToMoney(foldVaultCents(rows.map((row) => ({
    idempotencyKey: row.key,
    type: row.type,
    effect: row.effect,
    amountCents: moneyToCents(Number(row.amount)),
    status: row.status,
    effectiveDate: row.date,
  }))));
  if (!near(balance, 5594.08)) throw new Error(`Saldo ${balance}`);
  const practical = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, PRACTICAL_KEY));
  if (!near(Number(practical[0]?.value), 5594.08)) throw new Error("Saldo prático não atualizou");
  const day26 = await db.select({ id: operationDays.id }).from(operationDays).where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, "2026-10-26")));
  const day24 = await db.select({ id: operationDays.id }).from(operationDays).where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, "2026-10-24")));
  if (day26.length !== 0 || day24.length !== 0) throw new Error("Foi criado dia operacional");
  const meta = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, META_KEY));
  const value = meta[0]?.value as { cofrinho?: Record<string, number>; closure?: Record<string, { status?: string }>; pendingPiggyTransfers?: Array<{ id: string; ledgerPosted?: boolean }> };
  if (value.closure?.["2026-10-23"]?.status !== "closed_with_note") throw new Error("Classificação de 23/10 alterada");
  if ((value.pendingPiggyTransfers ?? []).filter((item) => item.id === DEPOSIT_KEY && item.ledgerPosted).length !== 1) {
    throw new Error("Rastro do depósito perdido");
  }
  const stock = await db.select({ stock: products.stockQuantity }).from(products).where(eq(products.name, "Mistão Frito"));
  if (stock[0]?.stock !== 525) throw new Error("Mistão alterado");
  console.log(JSON.stringify({ balance, depositDate: deposit.date, day26: day26.length, mistao: stock[0]?.stock }));
}

async function expectDuplicate(db: Awaited<ReturnType<typeof getPostgresDb>>) {
  const account = await db.select({ id: vaultAccounts.id }).from(vaultAccounts).where(eq(vaultAccounts.slug, "salgados-e-sanduiches"));
  try {
    await db.insert(vaultMovements).values({
      id: generateId(),
      businessId: BIZ,
      accountId: account[0]!.id,
      movementType: "deposit",
      effect: "credit",
      amount: "248.00",
      effectiveDate: "2026-10-24",
      description: "tentativa duplicada",
      idempotencyKey: DEPOSIT_KEY,
      status: "posted",
      metadata: {},
    });
    throw new Error("A chave de idempotência aceitou duplicata");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/idempotency|duplicate key|unique/i.test(message)) throw error;
  }
  const count = await db.select({ n: sql<number>`count(*)::int` }).from(vaultMovements).where(eq(vaultMovements.idempotencyKey, DEPOSIT_KEY));
  if (Number(count[0]?.n) !== 1) throw new Error("Depósito duplicado");
}

main().catch(async (error) => {
  console.error(error);
  await closePostgresConnection();
  process.exit(1);
});
