/**
 * Patch idempotente: depósito cofrinho R$118 REALIZADO em 19/10.
 * Saldo observado MP R$4.974,61 · Δ R$2,09 variação não classificada (não bankYield).
 * Uso: pnpm tsx scripts/patch-deposit-1910.ts [--dry]
 */
import "./load-env";
import { getDiaryEntry, upsertDiaryEntry } from "../src/lib/diary-service";
import { CLOSING_2026_10_19 } from "../src/lib/finance/day-closing";
import { closeDay } from "../src/lib/zaivon/zaivon-service";
import { countSalesForDate } from "@/platform/db/repositories/sale-repository";

const DATE = "2026-10-19";
const TARGET_DEPOSIT = 118;
const TARGET_CLOSING = 4974.61;
const TARGET_OPENING = 4854.52;
const UNCLASSIFIED_DELTA = 2.09; // 4974.61 − (4854.52 + 118)

function moneyOk(dc: NonNullable<Awaited<ReturnType<typeof getDiaryEntry>>>["dayClosing"]): boolean {
  if (!dc) return false;
  return (
    Math.abs(dc.competenceRevenue - 170) < 0.01 &&
    Math.abs(dc.cash.cashIn - 118) < 0.01 &&
    Math.abs(dc.costs.ownCost - 110) < 0.01 &&
    Math.abs(dc.competenceProfit - 60) < 0.01 &&
    Math.abs(dc.cashManagementResult - 8) < 0.01 &&
    Math.abs(dc.newCredit - 52) < 0.01 &&
    Math.abs(dc.lossesAmount - 25) < 0.01
  );
}

function depositAlreadyApplied(dc: NonNullable<Awaited<ReturnType<typeof getDiaryEntry>>>["dayClosing"]): boolean {
  if (!dc) return false;
  return (
    Math.abs(dc.piggyBank.deposit - TARGET_DEPOSIT) < 0.01 &&
    Math.abs(dc.piggyBank.closingBalance - TARGET_CLOSING) < 0.01 &&
    Math.abs(dc.piggyBank.bankYield - 0) < 0.01 &&
    Math.abs(dc.piggyBank.openingBalance - TARGET_OPENING) < 0.01 &&
    moneyOk(dc)
  );
}

async function main() {
  const dry = process.argv.includes("--dry");
  const before = await getDiaryEntry("salgados", DATE);
  if (!before?.dayClosing) throw new Error(`${DATE}: dayClosing ausente — rode register-day-1910 antes.`);

  const salesN = await countSalesForDate("salgados", DATE);
  console.log("=== ANTES ===");
  console.log({
    diaryId: before.id,
    salesCount: salesN,
    deposit: before.dayClosing.piggyBank.deposit,
    opening: before.dayClosing.piggyBank.openingBalance,
    bankYield: before.dayClosing.piggyBank.bankYield,
    closing: before.dayClosing.piggyBank.closingBalance,
    cashIn: before.dayClosing.cash.cashIn,
    ownCost: before.dayClosing.costs.ownCost,
    competence: before.dayClosing.competenceRevenue,
    competenceProfit: before.dayClosing.competenceProfit,
    cashMgmt: before.dayClosing.cashManagementResult,
  });

  if (!moneyOk(before.dayClosing)) {
    throw new Error("Valores financeiros 19/10 divergem do canônico — abortando (não forçar depósito).");
  }

  // Guardrail: 15 e 16 intactos
  const d15 = await getDiaryEntry("salgados", "2026-10-15");
  const d16 = await getDiaryEntry("salgados", "2026-10-16");
  if (!d15?.dayClosing || Math.abs(d15.dayClosing.cash.cashIn - 217) > 0.01) {
    throw new Error("15/10 inconsistente — abortando");
  }
  if (!d16?.dayClosing || Math.abs(d16.dayClosing.cash.cashIn - 207) > 0.01) {
    throw new Error("16/10 inconsistente — abortando");
  }

  const closing = CLOSING_2026_10_19;
  if (Math.abs(closing.piggyBank.deposit - TARGET_DEPOSIT) > 0.01) {
    throw new Error("CLOSING_2026_10_19.piggyDeposit ≠ 118");
  }
  if (Math.abs(closing.piggyBank.closingBalance - TARGET_CLOSING) > 0.01) {
    throw new Error("CLOSING_2026_10_19.piggyClosing ≠ 4974.61");
  }
  if (Math.abs(closing.piggyBank.bankYield) > 0.001) {
    throw new Error("bankYield deve ser 0 (Δ2,09 não é rendimento)");
  }

  const arithmetic = TARGET_OPENING + TARGET_DEPOSIT;
  if (Math.abs(TARGET_CLOSING - arithmetic - UNCLASSIFIED_DELTA) > 0.01) {
    throw new Error(`Δ esperado ${UNCLASSIFIED_DELTA} ≠ ${TARGET_CLOSING - arithmetic}`);
  }

  if (depositAlreadyApplied(before.dayClosing)) {
    console.log("PATCH_ALREADY_OK — depósito 118 e saldo 4974,61 já aplicados; sem alteração.");
    console.log("=== DEPOIS (inalterado) ===");
    console.log({
      diaryId: before.id,
      deposit: before.dayClosing.piggyBank.deposit,
      closing: before.dayClosing.piggyBank.closingBalance,
      bankYield: before.dayClosing.piggyBank.bankYield,
    });
    process.exit(0);
  }

  if (dry) {
    console.log("DRY — aplicaria:", {
      deposit: TARGET_DEPOSIT,
      closing: TARGET_CLOSING,
      bankYield: 0,
      unclassifiedDelta: UNCLASSIFIED_DELTA,
    });
    console.log("DRY_OK");
    process.exit(0);
  }

  const { id: diaryId, createdAt: _c, ...rest } = before;
  const tags = (rest.tags ?? []).filter((t) => t !== "deposit-pending");
  await upsertDiaryEntry({
    ...rest,
    dayClosing: closing,
    observations: [
      rest.observations ?? "",
      "---",
      `PATCH DEPÓSITO 19/10: piggyDeposit 0→118 REALIZADO · saldo observado MP 4974,61 · Δ ${UNCLASSIFIED_DELTA} variação NÃO CLASSIFICADA (bankYield=0). Financeiro 170/118/110/60/8 preservado.`,
    ]
      .filter(Boolean)
      .join("\n"),
    tags: Array.from(new Set([...tags, "zaivon-v2", "day-closing-v2", "homolog-1910", "deposit-done-1910"])),
  });

  await closeDay(
    DATE,
    "closed_with_note",
    "FINANCEIRO CONCILIADO — DEPÓSITO R$118 REALIZADO — RESSALVA VARIAÇÃO BANCÁRIA R$2,09",
    TARGET_CLOSING,
  );

  const after = await getDiaryEntry("salgados", DATE);
  if (!after?.dayClosing || !depositAlreadyApplied(after.dayClosing)) {
    throw new Error("Patch não persistiu corretamente");
  }

  // Re-check 15/16
  const d15b = await getDiaryEntry("salgados", "2026-10-15");
  const d16b = await getDiaryEntry("salgados", "2026-10-16");
  if (Math.abs((d15b?.dayClosing?.cash.cashIn ?? 0) - 217) > 0.01) throw new Error("15/10 alterado!");
  if (Math.abs((d16b?.dayClosing?.cash.cashIn ?? 0) - 207) > 0.01) throw new Error("16/10 alterado!");
  if (Math.abs((d16b?.dayClosing?.piggyBank.deposit ?? 0) - 127) > 0.01) throw new Error("16/10 depósito alterado!");

  const salesNb = await countSalesForDate("salgados", DATE);
  if (salesNb !== salesN) throw new Error(`Vendas 19/10 mudaram ${salesN}→${salesNb} — indevido`);

  console.log("=== DEPOIS ===");
  console.log({
    diaryId: after.id,
    salesCount: salesNb,
    deposit: after.dayClosing.piggyBank.deposit,
    opening: after.dayClosing.piggyBank.openingBalance,
    bankYield: after.dayClosing.piggyBank.bankYield,
    closing: after.dayClosing.piggyBank.closingBalance,
    arithmeticClose: arithmetic,
    unclassifiedDelta: UNCLASSIFIED_DELTA,
    cashIn: after.dayClosing.cash.cashIn,
    ownCost: after.dayClosing.costs.ownCost,
    competence: after.dayClosing.competenceRevenue,
    competenceProfit: after.dayClosing.competenceProfit,
    cashMgmt: after.dayClosing.cashManagementResult,
    hasDivergentNote: after.dayClosing.reconciliation.notes.some((n) => /DIVERGENTE|2[,.]09|não classif/i.test(n)),
  });
  console.log("PATCH_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
