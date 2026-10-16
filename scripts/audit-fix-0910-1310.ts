/**
 * Correções comprovadas 09/10 + 13/10 (somente leitura-safe / idempotente).
 *
 * 13/10 (CORRIGIDA):
 *   - quantity_lost e operational_losses: 7 → 3 (sem novas vendas)
 *   - dayClosing v2: fat 163 · caixa 143 · lucro competência 127 · resultado caixa 107
 *   - preserva venda Henrique R$20 (já existente) e cofrinho 4483,49
 *
 * 09/10 (DOCUMENTADA, sem sobrescrever números originais):
 *   - dayClosing v2 espelhando diário original + quadro de conciliação
 *   - Meia Sola / NI: ocorrência vs baixa; sem criar operational_losses
 *
 * Uso: pnpm tsx scripts/audit-fix-0910-1310.ts [--dry]
 */
import "./load-env";
import { and, eq, inArray } from "drizzle-orm";
import {
  CLOSING_2026_10_09,
  CLOSING_2026_10_13,
  CLOSING_2026_10_14,
} from "../src/lib/finance/day-closing";
import { getDiaryEntry, upsertDiaryEntry } from "../src/lib/diary-service";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { ensureOperationDayId } from "../src/platform/db/repositories/operation-day-repository";
import { listSettingsMap } from "../src/platform/db/repositories/settings-repository";
import { clients, operationalLosses, sales } from "../src/lib/db/postgres/schema";
import { queryAll, queryRun } from "../src/platform/db/query";

const BUSINESS = "salgados";
const HENRIQUE = "Henrique Alberto Matos Da Rocha";
const HENRIQUE_SALE_ID = "2762e6cb-45c9-423f-8345-bd253513b66c";
const META_KEY = "omni_v2_meta_salgados";
const DRY = process.argv.includes("--dry");
/** Motivo canônico — aplicado DEPOIS do upsert do diário (sync recria operational_losses). */
const LOSS_13_REASON =
  "3 salgados retirados sem pagamento na Acal (pessoas não identificadas) — perda definitiva R$15. " +
  "Ajuste 15/10/2026: era 7; 4 un. reclassificadas como venda Henrique R$20 (já em sales, sem nova venda).";

const MEIA_SOLA_ID = "c0274cb3-7f01-4696-aa18-3c7f5349f7e0";
const NI_SALGADOS_ID = "4d4ed217-fd52-4eb1-b508-62ac08e02942";
const NI_SANDUICHE_ID = "26121526-8dbd-439e-acfc-9a97e8f701cf";

async function assertHenriquePreserved(): Promise<void> {
  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({
        id: sales.id,
        total: sales.totalAmount,
        status: sales.paymentStatus,
        settlement: sales.settlementDate,
        date: sales.saleDate,
      })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, toDbBusinessId(BUSINESS)),
          eq(sales.saleDate, "2026-10-13"),
          eq(clients.name, HENRIQUE),
        ),
      ),
  );
  const debt = rows.find((r) => r.id === HENRIQUE_SALE_ID || Number(r.total) === 20);
  const unit = rows.find((r) => Number(r.total) === 5);
  if (!debt) throw new Error("Venda Henrique R$20 (13/10) ausente — abortado");
  if (debt.status !== "paid" || debt.settlement !== "2026-10-14") {
    throw new Error(`Henrique R$20 status/settlement inesperado: ${debt.status} / ${debt.settlement}`);
  }
  if (!unit) throw new Error("Venda Henrique R$5 (queijo 13/10) ausente — abortado");
  if (rows.filter((r) => Number(r.total) === 20).length !== 1) {
    throw new Error("Duplicata da venda Henrique R$20 detectada — abortado");
  }
  console.log(`  ✓ Henrique preservado: R$5 (${unit.id.slice(0, 8)}…) + R$20 (${debt.id.slice(0, 8)}…) quitado 14/10`);
}

/**
 * O upsert do diário deleta/recria operational_losses a partir de quantityLost.
 * Por isso esta etapa roda DEPOIS de persistDiary1310 e só enriquece produto/motivo.
 */
async function enrichOperationalLoss1310(): Promise<{ id: string; quantity: number }> {
  const opDayId = await ensureOperationDayId(BUSINESS, "2026-10-13");
  const db = await getPostgresDb();
  const existing = await queryAll(
    db.select().from(operationalLosses).where(eq(operationalLosses.operationDayId, opDayId)),
  );
  if (existing.length !== 1) {
    throw new Error(`operational_losses 13/10: esperado 1 registro, há ${existing.length}`);
  }
  const row = existing[0]!;
  const qty = Number(row.quantity);
  if (qty !== 3) throw new Error(`operational_losses qty ${qty} ≠ 3 após diário`);
  if (!DRY) {
    await queryRun(
      db
        .update(operationalLosses)
        .set({
          productName: "Salgado (sabor não identificado)",
          reason: LOSS_13_REASON,
          updatedAt: new Date(),
        })
        .where(eq(operationalLosses.id, row.id)),
    );
  }
  console.log(`  ✓ operational_losses ${row.id}: qty 3 · produto/motivo enriquecidos`);
  return { id: row.id, quantity: 3 };
}

async function persistDiary1310(): Promise<void> {
  const entry = await getDiaryEntry(BUSINESS, "2026-10-13");
  if (!entry) throw new Error("Diário 13/10 ausente");
  const closing = CLOSING_2026_10_13;
  if (closing.competenceRevenue !== 163 || closing.cash.cashIn !== 143) {
    throw new Error("CLOSING_2026_10_13 fora do canônico");
  }
  if (closing.competenceProfit !== 127 || closing.cashManagementResult !== 107) {
    throw new Error("Lucros 13/10 fora do canônico");
  }
  if (!DRY) {
    const { id: _id, createdAt: _c, ...rest } = entry;
    await upsertDiaryEntry({
      ...rest,
      version: 2,
      profit: closing.cashManagementResult,
      revenue: {
        received: closing.cash.cashIn,
        pending: 7,
        total: closing.competenceRevenue,
      },
      quantitySold: 31,
      quantityLost: 3,
      lossReason:
        "3 salgados retirados sem pagamento na Acal — perda definitiva. (4 un. antes em perdas = venda Henrique R$20.)",
      dayClosing: closing,
      observations: [
        "Fechamento 13/10 — dayClosing v2 (auditoria 15/10/2026).",
        "Salgados: 30 disponíveis = 27 vendidos + 3 perdidos.",
        "Sanduíches: 8 feitos · 3 pagos R$21 + 1 fiado Mikelly R$7 · 4 sobras → 14/10.",
        "Faturamento competência R$163 (inclui Henrique R$20) · Caixa R$143 (136 vendas + 7 quitação Vanderson).",
        "Custo próprio R$36 · terceiros R$74 · Lucro competência R$127 · Resultado caixa R$107 · Depósito R$107.",
        "Cofrinho R$4.483,49 (preservado). Henrique R$20 quitado em 14/10 — sem duplicar recebimento.",
        "Ajuste vs registro original: quantity_lost 7→3; revenue.total 150→163; quantity_sold 27→31.",
      ].join("\n"),
      tags: Array.from(new Set([...(rest.tags ?? []), "zaivon-v2", "day-closing-v2", "audit-1310"])),
    });
  }
  console.log("  ✓ diário 13/10 → v2 · lost 3 · fat 163 · caixa 143 · competências 127/107");
}

async function salesSum(date: string): Promise<{ fat: number; paid: number; pending: number; units: number; n: number }> {
  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({
        total: sales.totalAmount,
        status: sales.paymentStatus,
        id: sales.id,
      })
      .from(sales)
      .where(and(eq(sales.businessId, toDbBusinessId(BUSINESS)), eq(sales.saleDate, date))),
  );
  let fat = 0;
  let paid = 0;
  let pending = 0;
  for (const r of rows) {
    const t = Number(r.total);
    fat += t;
    if (r.status === "paid") paid += t;
    else pending += t;
  }
  return { fat, paid, pending, units: 0, n: rows.length };
}

async function persistDiary0910(): Promise<void> {
  const entry = await getDiaryEntry(BUSINESS, "2026-10-09");
  if (!entry) throw new Error("Diário 09/10 ausente");
  const bank = await salesSum("2026-10-09");
  const closing = CLOSING_2026_10_09;
  const metaRaw = (await listSettingsMap())[META_KEY];
  const lossIds: string[] = metaRaw ? (JSON.parse(metaRaw) as { lossSaleIds?: string[] }).lossSaleIds ?? [] : [];
  const hasMeia = lossIds.includes(MEIA_SOLA_ID);
  const hasNi = lossIds.includes(NI_SALGADOS_ID) && lossIds.includes(NI_SANDUICHE_ID);

  const pendingAtClose = 70;
  const dayPaidAtClose = bank.fat - pendingAtClose; // 269-70=199 se fat=269
  const reconstructed = dayPaidAtClose + 20;
  const pc = CLOSING_2026_10_09.provisionalCompetence!;
  const reconciliation = [
    "— Quadro de conciliação 09/10 (diário × banco · competência PROVISÓRIA) —",
    `| Camada | Caixa | Pending | Total competência | Lucro competência | Lucro caixa |`,
    `| Diário original (preservado) | 214 | 70 | 284 | ${pc.fromDiary.profit} PROVISÓRIO (=284−64) | 150 CONFIRMADO |`,
    `| Sales identificadas | — | — | ${pc.fromIdentifiedSales.revenue} | ${pc.fromIdentifiedSales.profit} (=269−64) | — |`,
    `| Δ competência diário−sales | | | ${pc.gap} PENDENTE | ${pc.fromDiary.profit - pc.fromIdentifiedSales.profit} | |`,
    "",
    "Caixa na data do fechamento (NÃO usar status atuais):",
    `· Pending no encerramento = 70 → day paid at close = ${bank.fat} − 70 = ${dayPaidAtClose}.`,
    `· Quitações antigas R$20 → caixa reconstruído = ${dayPaidAtClose} + 20 = ${reconstructed}.`,
    `· Diário caixa 214 (=194 dia + 20). Δ vs reconstruído ${reconstructed} = ${(reconstructed - 214).toFixed(0)} PENDENTE.`,
    `· Snapshot atual paid=${bank.paid.toFixed(0)} = ${dayPaidAtClose} + Vanderson 7 (quitado 13/10) — enganoso como histórico.`,
    "",
    "Baixas históricas (ocorrência ≠ baixa; sem duplicar em operational_losses):",
    `· Meia Sola R$32: ocorrência 09/10 · baixa lossSaleIds 13/10 · ${hasMeia ? "OK" : "FALTA"}.`,
    `· NI R$17: ocorrência 09/10 · baixa 13/10 · ${hasNi ? "OK" : "FALTA"}.`,
    "",
    "competenceProfit do dayClosing = 205 (sales), NÃO 220. Ver provisionalCompetence.fromDiary.",
  ].join("\n");

  if (!DRY) {
    const { id: _id, createdAt: _c, ...rest } = entry;
    const baseObs = (rest.observations ?? "").split("\n— Quadro de conciliação")[0]!.trimEnd();
    await upsertDiaryEntry({
      ...rest,
      version: 2,
      // Colunas legadas = números originais (não sobrescrever)
      profit: 150,
      revenue: { received: 214, pending: 70, total: 284 },
      quantitySold: 46,
      quantityLost: 0,
      dayClosing: closing,
      observations: [baseObs, "", reconciliation].join("\n"),
      tags: Array.from(new Set([...(rest.tags ?? []), "zaivon-v2", "day-closing-v2", "audit-0910", "reconciliacao-pendente"])),
    });
  }
  console.log(`  ✓ diário 09/10 → v2 com conciliação (números originais 214/70/284/150) · Σ sales=${bank.fat}`);
}

async function refreshDiary1410Status(): Promise<void> {
  const entry = await getDiaryEntry(BUSINESS, "2026-10-14");
  if (!entry) throw new Error("Diário 14/10 ausente");
  const closing = CLOSING_2026_10_14;
  if (closing.competenceStatus !== "confirmed") throw new Error("14/10 deve ser confirmed");
  if (!DRY) {
    const { id: _id, createdAt: _c, ...rest } = entry;
    await upsertDiaryEntry({
      ...rest,
      version: 2,
      profit: closing.cashManagementResult,
      revenue: {
        received: closing.cash.cashIn,
        pending: closing.newCredit,
        total: closing.competenceRevenue,
      },
      quantitySold: rest.quantitySold,
      quantityLost: rest.quantityLost,
      dayClosing: closing,
    });
  }
  console.log("  ✓ diário 14/10 dayClosing confirmed preservado (251/231/151/131)");
}

async function assertRecoverable72(): Promise<void> {
  const db = await getPostgresDb();
  const metaRaw = (await listSettingsMap())[META_KEY];
  const lost = new Set(metaRaw ? (JSON.parse(metaRaw) as { lossSaleIds?: string[] }).lossSaleIds ?? [] : []);
  const open = await queryAll(
    db
      .select({ name: clients.name, total: sales.totalAmount, received: sales.amountReceived, id: sales.id })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(inArray(sales.paymentStatus, ["pending", "partial"])),
  );
  const by = new Map<string, number>();
  for (const r of open) {
    if (lost.has(r.id)) continue;
    const amt = Number(r.total) - Number(r.received);
    by.set(r.name, (by.get(r.name) ?? 0) + amt);
  }
  const mikelly = [...by.entries()].filter(([n]) => /mikelly/i.test(n)).reduce((s, [, v]) => s + v, 0);
  const laura = [...by.entries()].filter(([n]) => /laura/i.test(n)).reduce((s, [, v]) => s + v, 0);
  const carlos = [...by.entries()].filter(([n]) => /^Carlos Eduardo$/i.test(n)).reduce((s, [, v]) => s + v, 0);
  const total = mikelly + laura + carlos;
  console.log(`  · recuperável: Mikelly ${mikelly} · Laura ${laura} · Carlos ${carlos} · Σ ${total}`);
  if (Math.abs(total - 72) > 0.001) throw new Error(`Recuperável R$${total} ≠ 72`);
  console.log("  ✓ recuperável operacional R$72 preservado");
}

async function main() {
  console.log(`Auditoria corretiva 09/10+13/10${DRY ? " (DRY)" : ""}`);
  console.log("1) Henrique 13/10");
  await assertHenriquePreserved();
  console.log("2) Diário 13/10 v2 (quantity_lost 3 — sync idempotente preserva UUID)");
  await persistDiary1310();
  console.log("3) Enriquecer operational_losses 13/10");
  const loss = await enrichOperationalLoss1310();
  console.log("4) Diário 09/10 conciliação (sem sobrescrever)");
  await persistDiary0910();
  console.log("5) Diário 14/10 (preservar confirmed)");
  await refreshDiary1410Status();
  console.log("6) Fiados recuperáveis");
  await assertRecoverable72();

  console.log("\nResumo:");
  console.log(`  loss ${loss.id}: qty ${loss.quantity}`);
  console.log(`  CLOSING_13: fat ${CLOSING_2026_10_13.competenceRevenue} caixa ${CLOSING_2026_10_13.cash.cashIn} comp ${CLOSING_2026_10_13.competenceProfit} ger ${CLOSING_2026_10_13.cashManagementResult}`);
  const pc = CLOSING_2026_10_09.provisionalCompetence!;
  console.log(`  CLOSING_09: caixa ${CLOSING_2026_10_09.cash.cashIn} · competência PROVISÓRIA diary ${pc.fromDiary.profit} / sales ${pc.fromIdentifiedSales.profit} · gap ${pc.gap}`);
  console.log(`  CLOSING_14: fat ${CLOSING_2026_10_14.competenceRevenue} status ${CLOSING_2026_10_14.competenceStatus}`);
  console.log(DRY ? "DRY_OK" : "AUDIT_FIX_0910_1310_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
