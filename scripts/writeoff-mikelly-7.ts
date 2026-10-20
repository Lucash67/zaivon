/**
 * Baixa por inadimplência: Mikelly R$7 (sanduíche 14/10).
 * Uso: pnpm tsx scripts/writeoff-mikelly-7.ts [--dry]
 *
 * R$12 abertos = R$7 (14/10, desta baixa) + R$5 (15/10 fiado salgado — permanece cobrável).
 * Não altera caixa/cofrinho/quitações de 16/10 nem a perda de salgado NI do dia.
 */
import "./load-env";
import { and, eq } from "drizzle-orm";
import { getDiaryEntry, upsertDiaryEntry } from "../src/lib/diary-service";
import { CLOSING_2026_10_16, type DayClosingFinance } from "../src/lib/finance/day-closing";
import { markDebtAsLoss } from "../src/lib/zaivon/zaivon-service";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { clients, sales } from "../src/lib/db/postgres/schema";
import { queryAll, queryRun } from "../src/platform/db/query";

const BUSINESS = "salgados";
const MIKELLY = "Maria Mikelly Monteiro Coutinho";
/** Sanduíche 14/10 — saldo remanescente da dívida reconhecida R$50 − R$43. */
const WRITEOFF_SALE_ID = "4834b3a8-fd8b-4876-9354-2ecee94028da";
/** Fiado salgado 15/10 — R$5 adicionais (fora do R$50); permanece aberto. */
const KEEP_OPEN_SALE_ID = "57f333c9-a36e-4ad0-975b-ab5e00fd5acd";
const WRITEOFF_DATE = "2026-10-19";
const WRITEOFF_NOTE =
  "INADIMPLÊNCIA DEFINITIVA / PERDA POR CRÉDITO INCOBRÁVEL — R$7. Dívida reconhecida R$50 − pagamento 16/10 R$43. NÃO recebido. Histórico e quitação parcial preservados. Baixa 19/10/2026. Recuperação posterior possível via reabertura.";

async function main() {
  const dry = process.argv.includes("--dry");
  const db = await getPostgresDb();
  const biz = toDbBusinessId(BUSINESS);

  const open = await queryAll(
    db
      .select({
        id: sales.id,
        date: sales.saleDate,
        status: sales.paymentStatus,
        total: sales.totalAmount,
        received: sales.amountReceived,
        notes: sales.notes,
      })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(and(eq(sales.businessId, biz), eq(clients.name, MIKELLY), eq(sales.paymentStatus, "pending"))),
  );

  console.log("=== ABERTO Maria Mikelly (antes) ===");
  for (const r of open) {
    console.log(`${r.date} R$${r.total} id=${r.id.slice(0, 8)} · ${(r.notes ?? "").slice(0, 80)}`);
  }

  const target = open.find((r) => r.id === WRITEOFF_SALE_ID);
  const keep = open.find((r) => r.id === KEEP_OPEN_SALE_ID);
  if (!target) throw new Error(`Venda ${WRITEOFF_SALE_ID} não está pending — abortar`);
  if (Math.abs(Number(target.total) - 7) > 0.01) throw new Error(`Alvo ≠ R$7 (got ${target.total})`);
  if (!keep) throw new Error(`Fiado 15/10 ${KEEP_OPEN_SALE_ID} ausente — abortar (não baixar R$12 às cegas)`);
  if (Math.abs(Number(keep.total) - 5) > 0.01) throw new Error(`Keep-open ≠ R$5`);

  console.log("\n=== DIAGNÓSTICO R$12 → R$7 + R$5 ===");
  console.log("Quitação 16/10 R$43 = 02/10(15)+07/10(14)+09/10(7)+13/10(7).");
  console.log("Dívida reconhecida R$50 = esses 43 + remanescente 14/10(7).");
  console.log("R$5 extras = fiado salgado 15/10 (legítimo, fora do R$50) — NÃO baixar nesta operação.");
  console.log(`Baixa: ${WRITEOFF_SALE_ID.slice(0, 8)} · 14/10 sanduíche R$7`);
  console.log(`Permanece cobrável: ${KEEP_OPEN_SALE_ID.slice(0, 8)} · 15/10 salgado R$5`);

  if (dry) {
    console.log("DRY_OK");
    process.exit(0);
  }

  // 1) Atualizar nota da venda (status permanece pending — modelo lossSaleIds)
  await queryRun(
    db
      .update(sales)
      .set({
        notes: [target.notes, WRITEOFF_NOTE].filter(Boolean).join(" · "),
        updatedAt: new Date(),
      })
      .where(eq(sales.id, WRITEOFF_SALE_ID)),
  );

  // 2) Nota no fiado 15/10 (auditoria)
  await queryRun(
    db
      .update(sales)
      .set({
        notes: [
          keep.notes,
          "AUDITORIA 19/10: este R$5 (fiado 15/10) NÃO integra a dívida reconhecida R$50 nem a baixa de inadimplência R$7 do sanduíche 14/10. Permanece cobrável.",
        ]
          .filter(Boolean)
          .join(" · "),
        updatedAt: new Date(),
      })
      .where(eq(sales.id, KEEP_OPEN_SALE_ID)),
  );

  // 3) Baixa no meta (retira da cobrança ativa)
  await markDebtAsLoss(WRITEOFF_SALE_ID);
  console.log("  ✓ markDebtAsLoss R$7");

  // 4) Atualizar dayClosing 16/10 com historicalWriteOffs — sem mexer em caixa/cofrinho/lossesAmount
  const diary = await getDiaryEntry(BUSINESS, "2026-10-16");
  if (!diary?.dayClosing) throw new Error("Diário 16/10 sem dayClosing");

  const cashBefore = { ...diary.dayClosing.cash };
  const piggyBefore = { ...diary.dayClosing.piggyBank };
  const lossesBefore = {
    amount: diary.dayClosing.lossesAmount,
    units: diary.dayClosing.lossesUnits,
  };

  const writeOff = {
    saleId: WRITEOFF_SALE_ID,
    amount: 7,
    occurrenceDate: "2026-10-14",
    writeOffDate: WRITEOFF_DATE,
    classification: "fiado→inadimplencia_credito_incobravel→lossSaleIds",
    note: "Mikelly: R$50 reconhecidos − R$43 pagos em 16/10 = R$7. Baixa 19/10. NÃO entra em lossesAmount/quantityLost de salgado NI (R$5) de 16/10. NÃO altera caixa/cofrinho.",
  };

  const prev = diary.dayClosing.historicalWriteOffs ?? [];
  if (prev.some((w) => w.saleId === WRITEOFF_SALE_ID)) {
    console.log("  · historicalWriteOffs já continha esta sale — sem duplicar entrada");
  }

  const updatedClosing: DayClosingFinance = {
    ...diary.dayClosing,
    historicalWriteOffs: prev.some((w) => w.saleId === WRITEOFF_SALE_ID)
      ? prev
      : [...prev, writeOff],
    reconciliation: {
      ...diary.dayClosing.reconciliation,
      notes: [
        ...diary.dayClosing.reconciliation.notes.filter(
          (n) => !n.includes("Mikelly inadimplência R$7"),
        ),
        "Mikelly inadimplência R$7 (sanduíche 14/10) baixada em 19/10 via lossSaleIds — fora do caixa 16/10; distinta da perda salgado NI R$5.",
        "Mikelly fiado 15/10 R$5 permanece cobrável (origem da divergência R$12 vs R$7).",
      ],
    },
  };

  // Garantir imutáveis
  updatedClosing.cash = cashBefore;
  updatedClosing.piggyBank = piggyBefore;
  updatedClosing.lossesAmount = lossesBefore.amount;
  updatedClosing.lossesUnits = lossesBefore.units;

  const { id: _id, createdAt: _c, ...rest } = diary;
  await upsertDiaryEntry({
    ...rest,
    dayClosing: updatedClosing,
    observations: [
      rest.observations,
      `BAIXA MIKELLY 19/10: inadimplência R$7 (sale ${WRITEOFF_SALE_ID.slice(0, 8)}, ocorrência 14/10). Fiado 15/10 R$5 permanece aberto. Caixa/cofrinho 16/10 inalterados.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    tags: Array.from(new Set([...(rest.tags ?? []), "mikelly-writeoff-7"])),
  });

  // Conferência
  if (Math.abs(updatedClosing.cash.cashIn - 207) > 0.01) throw new Error("caixa alterado!");
  if (Math.abs(updatedClosing.piggyBank.deposit - 127) > 0.01) throw new Error("depósito alterado!");
  if (Math.abs(updatedClosing.piggyBank.closingBalance - 4854.52) > 0.01) throw new Error("cofrinho alterado!");
  if (Math.abs(updatedClosing.lossesAmount - 5) > 0.01) throw new Error("lossesAmount salgado NI alterado!");

  const stillOpen = await queryAll(
    db
      .select({ id: sales.id, date: sales.saleDate, total: sales.totalAmount, status: sales.paymentStatus })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(and(eq(sales.businessId, biz), eq(clients.name, MIKELLY), eq(sales.paymentStatus, "pending"))),
  );
  console.log("\n=== PENDING no banco (ainda pending; R$7 em lossSaleIds) ===");
  for (const r of stillOpen) {
    console.log(`${r.date} R$${r.total} id=${r.id.slice(0, 8)} status=${r.status}`);
  }

  const saved = await getDiaryEntry(BUSINESS, "2026-10-16");
  console.log("\n=== 16/10 imutáveis ===");
  console.log({
    cashIn: saved?.dayClosing?.cash.cashIn,
    deposit: saved?.dayClosing?.piggyBank.deposit,
    piggy: saved?.dayClosing?.piggyBank.closingBalance,
    lossesAmount: saved?.dayClosing?.lossesAmount,
    writeOffs: saved?.dayClosing?.historicalWriteOffs?.map((w) => ({
      amount: w.amount,
      sale: w.saleId.slice(0, 8),
      class: w.classification,
    })),
  });

  // Sync constant reference note (CLOSING export used for rebuilds)
  void CLOSING_2026_10_16;

  console.log("WRITEOFF_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
