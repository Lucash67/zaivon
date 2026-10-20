/**
 * Registra 19/10/2026 — homologação final (idempotente).
 * Uso: pnpm tsx scripts/register-day-1910.ts [--dry]
 *
 * Financeiro: vendas 118 · fiados 52 · competência 170 · ownCost 110 · lucro 60 · resultado caixa 8
 * Depósito R$118 REALIZADO — piggyDeposit=118 · saldo observado MP 4974,61 · Δ2,09 não classificado
 * Mikelly R$7 = sanduíche NOVO (não reativa inadimplência 14/10)
 * Henrique R$20 espécie→Pix = conversão, não venda/quitação
 */
import "./load-env";
import { and, eq } from "drizzle-orm";
import { cleanupOperationDay } from "./cleanup-operation-day";
import { commitDayRegistration } from "../src/lib/day-registration/day-registration-service";
import { sanitizeRegistrationPlan } from "../src/lib/day-registration/plan-sanitize";
import type { DayRegistrationPlan, DraftSale } from "../src/lib/day-registration/types";
import { getDiaryEntry, upsertDiaryEntry } from "../src/lib/diary-service";
import { CLOSING_2026_10_19 } from "../src/lib/finance/day-closing";
import { UNIDENTIFIED_FLAVOR_PRODUCT_NAME } from "../src/lib/salgados-flavors";
import { closeDay, markDebtAsLoss } from "../src/lib/zaivon/zaivon-service";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { clients, saleItems, sales } from "../src/lib/db/postgres/schema";
import { queryAll, queryRun } from "../src/platform/db/query";
import { countSalesForDate } from "@/platform/db/repositories/sale-repository";

const BUSINESS = "salgados";
const DATE = "2026-10-19";
const SANDUICHE = "Sanduíche Natural";
const SANDUICHE_COST = 2;
const LOSS_CLIENT = "Retirada não identificada (2026-10-19)";
const MIKELLY = "Maria Mikelly Monteiro Coutinho";
const JOAO_VICTOR = "João Victor dos Santos Carvalho";
const HENRIQUE = "Henrique";
const GABRIELA = "Gabriela Barreto Vasconcelos";

interface PricedSale {
  sale: DraftSale;
  unitPrice: number;
  sandwich: boolean;
  isLoss?: boolean;
}

function salgado(
  time: string,
  clientName: string,
  quantity: number,
  extra: Partial<DraftSale> = {},
): PricedSale {
  return {
    sale: {
      time,
      clientName,
      quantity,
      productName: UNIDENTIFIED_FLAVOR_PRODUCT_NAME,
      paymentMethod: "pix",
      paymentStatus: "paid",
      department: "Acal",
      ...extra,
    },
    unitPrice: 5,
    sandwich: false,
  };
}

function sanduiche(
  time: string,
  clientName: string,
  quantity: number,
  unitPrice: number,
  extra: Partial<DraftSale> = {},
): PricedSale {
  return {
    sale: {
      time,
      clientName,
      quantity,
      productName: SANDUICHE,
      paymentMethod: "pix",
      paymentStatus: "paid",
      department: unitPrice >= 8 ? "Unifor" : "Acal",
      ...extra,
    },
    unitPrice,
    sandwich: true,
  };
}

/**
 * Unidades: 22 pagos + JV2 + Henrique7 + 5 NI = 36 salgados.
 * Sanduíches: 1 pago R$8 + 1 fiado Mikelly R$7 (= 2 novos).
 */
const PRICED: PricedSale[] = [
  // Unifor manhã — 7 pagos
  salgado("09:00", "Unifor manhã (lote pago 19/10)", 7, {
    department: "Unifor",
    notes: "7 salgados Unifor manhã pagos. HOMOLOG-1910.",
  }),
  // Acal pagos — 14 (16 narrados − ajuste ao batimento financeiro 22; ver notes dayClosing)
  salgado("10:30", "Acal pagas (lote 19/10)", 14, {
    notes: "14 salgados Acal pagos (batimento financeiro 22 = Unifor7 + Acal14 + Gabriela1). HOMOLOG-1910.",
  }),
  // Gabriela
  salgado("14:00", GABRIELA, 1, {
    department: "Unifor",
    notes: "1 salgado Unifor — Gabriela Barreto. HOMOLOG-1910.",
  }),
  // Sanduíche pago R$8
  sanduiche("11:00", "Sanduíche Unifor pago (19/10)", 1, 8, {
    notes: "1 sanduíche novo pago R$8. HOMOLOG-1910.",
  }),

  // Fiados
  salgado("15:00", JOAO_VICTOR, 2, {
    paymentStatus: "pending",
    notes: "Fiado João Victor R$10 (2 salgados) — 19/10. HOMOLOG-1910.",
  }),
  sanduiche("15:10", MIKELLY, 1, 7, {
    paymentStatus: "pending",
    department: "Acal",
    notes:
      "Fiado Mikelly — sanduíche NOVO de 19/10 R$7. Distinto do R$7 de 14/10 já em lossSaleIds. NÃO reativar inadimplência antiga. HOMOLOG-1910.",
  }),
  salgado("16:00", HENRIQUE, 7, {
    paymentStatus: "pending",
    notes: "Fiado Henrique R$35 (7 salgados). Espécie→Pix R$20 do dia = conversão de meio, NÃO quitação deste fiado. HOMOLOG-1910.",
  }),

  // 5 NI — perda, não receita
  {
    ...salgado("17:00", LOSS_CLIENT, 5, {
      paymentStatus: "pending",
      paymentMethod: "cash",
      notes:
        "5 salgados Acal sem pagamento identificado. Valor comercial potencial R$25 — NÃO receita. Perda operacional. HOMOLOG-1910.",
    }),
    isLoss: true,
  },
];

const closing = CLOSING_2026_10_19;

function money(filter: (p: PricedSale) => boolean): number {
  return PRICED.filter(filter).reduce((s, p) => s + p.unitPrice * p.sale.quantity, 0);
}

function checkPlan(): void {
  const paid = (p: PricedSale) => (p.sale.paymentStatus ?? "paid") === "paid" && !p.isLoss;
  const paidSalgado = money((p) => paid(p) && !p.sandwich);
  const paidSandwich = money((p) => paid(p) && p.sandwich);
  const fiadoNew = money((p) => (p.sale.paymentStatus ?? "paid") === "pending" && !p.isLoss);
  const lossUnits = PRICED.filter((p) => p.isLoss).reduce((s, p) => s + p.sale.quantity, 0);
  const paidSalgadoUnits = PRICED.filter((p) => paid(p) && !p.sandwich).reduce(
    (s, p) => s + p.sale.quantity,
    0,
  );

  const checks: [string, number, number][] = [
    ["salgados pagos un", paidSalgadoUnits, 22],
    ["salgados pagos R$", paidSalgado, 110],
    ["sanduíche pago R$", paidSandwich, 8],
    ["vendas pagas R$", paidSalgado + paidSandwich, 118],
    ["fiados novos R$", fiadoNew, 52],
    ["perda un", lossUnits, 5],
    ["cashIn", closing.cash.cashIn, 118],
    ["ownCost", closing.costs.ownCost, 110],
    ["resultado caixa", closing.cashManagementResult, 8],
    ["competência", closing.competenceRevenue, 170],
    ["lucro competência", closing.competenceProfit, 60],
    ["depósito realizado", closing.piggyBank.deposit, 118],
    ["cofrinho observado", closing.piggyBank.closingBalance, 4974.61],
    ["bankYield (não classificar Δ2,09)", closing.piggyBank.bankYield, 0],
  ];
  for (const [label, got, want] of checks) {
    if (Math.abs(got - want) > 0.01) throw new Error(`Conferência falhou — ${label}: ${got} ≠ ${want}`);
    console.log(`  ✓ ${label}: ${got}`);
  }
}

async function applyRealPrices(saleIds: string[]): Promise<void> {
  const db = await getPostgresDb();
  for (let i = 0; i < saleIds.length; i++) {
    const p = PRICED[i]!;
    const items = await queryAll(db.select().from(saleItems).where(eq(saleItems.saleId, saleIds[i]!)));
    const unitCost = p.sandwich ? SANDUICHE_COST : 0;
    const total = p.unitPrice * p.sale.quantity;
    const cost = unitCost * p.sale.quantity;
    const isPaid = (p.sale.paymentStatus ?? "paid") === "paid";
    for (const item of items) {
      await queryRun(
        db
          .update(saleItems)
          .set({
            unitPrice: p.unitPrice.toFixed(2),
            unitCost: unitCost.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(saleItems.id, item.id)),
      );
    }
    await queryRun(
      db
        .update(sales)
        .set({
          totalAmount: total.toFixed(2),
          totalCost: cost.toFixed(2),
          profit: (total - cost).toFixed(2),
          amountReceived: isPaid ? total.toFixed(2) : "0.00",
          updatedAt: new Date(),
        })
        .where(eq(sales.id, saleIds[i]!)),
    );
  }
}

async function markLossSale(): Promise<void> {
  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({ id: sales.id })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, toDbBusinessId(BUSINESS)),
          eq(sales.saleDate, DATE),
          eq(clients.name, LOSS_CLIENT),
          eq(sales.paymentStatus, "pending"),
        ),
      ),
  );
  if (rows.length !== 1) throw new Error(`Perda: esperado 1 sale, got ${rows.length}`);
  await markDebtAsLoss(rows[0]!.id);
  console.log(`  ✓ perda 5 NI marcada lossSaleIds · ${rows[0]!.id.slice(0, 8)}`);
}

async function assertMikellyOldWriteOffIntact(): Promise<void> {
  const db = await getPostgresDb();
  const old = await queryAll(
    db
      .select({ id: sales.id, status: sales.paymentStatus, total: sales.totalAmount })
      .from(sales)
      .where(eq(sales.id, "4834b3a8-fd8b-4876-9354-2ecee94028da")),
  );
  if (old.length !== 1) throw new Error("Mikelly 14/10 write-off sale não encontrada");
  if (old[0]!.status !== "pending") throw new Error("Mikelly 14/10 não deve mudar de pending (lossSaleIds)");
  if (Math.abs(Number(old[0]!.total) - 7) > 0.01) throw new Error("Mikelly 14/10 total ≠ 7");
  console.log("  ✓ Mikelly 14/10 R$7 inadimplência intacta (não reativada)");
}

async function alreadyHomologated(): Promise<boolean> {
  const diary = await getDiaryEntry(BUSINESS, DATE);
  const dc = diary?.dayClosing;
  if (!dc) return false;
  return (
    Math.abs(dc.cash.cashIn - 118) < 0.01 &&
    Math.abs(dc.costs.ownCost - 110) < 0.01 &&
    Math.abs(dc.competenceRevenue - 170) < 0.01 &&
    Math.abs(dc.piggyBank.deposit - 118) < 0.01 &&
    Math.abs(dc.piggyBank.closingBalance - 4974.61) < 0.01
  );
}

async function main() {
  console.log(`Conferência do fechamento 19/10${process.argv.includes("--dry") ? " (DRY)" : ""}:`);
  checkPlan();

  if (process.argv.includes("--dry")) {
    console.log("DRY_OK");
    process.exit(0);
  }

  if (await alreadyHomologated()) {
    console.log("DAY_ALREADY_OK — 19/10 já homologado com valores canônicos; sem duplicar.");
    process.exit(0);
  }

  const existing = await countSalesForDate(BUSINESS, DATE);
  if (existing > 0) {
    throw new Error(`${DATE}: já existem ${existing} venda(s) sem dayClosing homologado. Abortando.`);
  }

  await cleanupOperationDay(BUSINESS, DATE);

  const observations = [
    "Fechamento 19/10 — HOMOLOGADO (depósito cofrinho PREVISTO).",
    "Salgados 36 · pagos 22 R$110 · fiados JV 10 + Henrique 35 · NI 5 R$25 (não receita) · estoque final 0.",
    "Sanduíches: 2 novos · pago 1 R$8 · fiado Mikelly NOVO R$7 · herdados manhã 4 (gap período 16→19).",
    "Caixa R$118 = só vendas pagas. Sem quitações antigas no dia.",
    "Competência R$170 = 118 + 52. Lucro competência R$60. Resultado caixa R$8. Desembolso R$0.",
    "Depósito R$118 REALIZADO (Mercado Pago). Saldo observado R$4.974,61 · Δ R$2,09 variação não classificada.",
    "Henrique R$20 espécie→Pix: conversão de meio, não venda/quitação.",
    "Mikelly R$7 de 14/10 (lossSaleIds) NÃO reativado.",
  ];

  const plan: DayRegistrationPlan = {
    businessId: BUSINESS,
    date: DATE,
    purchase: {
      totalUnits: 38,
      investment: closing.costs.ownCost,
      ownInvestment: closing.costs.ownCost,
      products: [
        { name: UNIDENTIFIED_FLAVOR_PRODUCT_NAME, quantity: 36 },
        { name: SANDUICHE, quantity: 2 },
      ],
    },
    summary: {
      revenue: closing.cash.cashIn,
      profit: closing.cashManagementResult,
      quantitySold: 22 + 1 + 2 + 1 + 7, // pagos salgado+sand + JV + Mikelly + Henrique (perda à parte)
      quantityLost: 5,
      lossReason: "5 salgados Acal sem pagamento identificado — perda operacional (não receita).",
      forecastProfit: closing.competenceProfit,
    },
    sales: PRICED.map((p) => p.sale),
    newClients: Array.from(new Set(PRICED.map((p) => p.sale.clientName))).map((name) => ({
      name,
      sector: name.includes("Unifor") || name === GABRIELA ? "Unifor" : "Acal",
    })),
    observations: observations.join("\n"),
    manualInsights:
      "Financeiro conciliado. Depósito R$118 realizado. Δ R$2,09 bancário não classificado como rendimento. Gap sanduíches 3 un permanece no período 16→19 sem data.",
    lessonsLearned:
      "Não reativar fiado baixado. Espécie→Pix ≠ venda. NI sem pagamento ≠ receita. Saldo observado ≠ aritmética depósito → documentar Δ sem forçar bankYield.",
  };

  const result = await commitDayRegistration(sanitizeRegistrationPlan(plan));
  if (result.saleIds.length !== PRICED.length) {
    throw new Error(`${result.saleIds.length} vendas gravadas, esperado ${PRICED.length}`);
  }
  await applyRealPrices(result.saleIds);
  await markLossSale();
  await assertMikellyOldWriteOffIntact();

  const entry = await getDiaryEntry(BUSINESS, DATE);
  if (!entry) throw new Error("diário ausente após commit");

  const { id: _id, createdAt: _c, ...rest } = entry;
  await upsertDiaryEntry({
    ...rest,
    version: 2,
    profit: closing.cashManagementResult,
    bonusIncome: 0,
    quantitySold: 33,
    quantityLost: 5,
    lossReason: "5 salgados Acal sem pagamento identificado — perda operacional (não receita).",
    revenue: {
      received: closing.cash.cashIn,
      pending: closing.newCredit,
      total: closing.competenceRevenue,
    },
    purchase: {
      totalUnits: 38,
      investment: closing.costs.ownCost,
      ownInvestment: closing.costs.ownCost,
      products: [
        { name: UNIDENTIFIED_FLAVOR_PRODUCT_NAME, quantity: 36 },
        { name: SANDUICHE, quantity: 2 },
      ],
    },
    dayClosing: closing,
    observations: observations.join("\n"),
    manualInsights: plan.manualInsights,
    lessonsLearned: plan.lessonsLearned,
    sales: {
      paidCount: PRICED.filter((p) => (p.sale.paymentStatus ?? "paid") === "paid" && !p.isLoss).length,
      creditCount: 3,
    },
    tags: Array.from(
      new Set([...(rest.tags ?? []), "zaivon-v2", "day-closing-v2", "homolog-1910", "deposit-done-1910"]),
    ),
  });

  await closeDay(
    DATE,
    "closed_with_note",
    "FINANCEIRO CONCILIADO — DEPÓSITO R$118 REALIZADO — RESSALVA VARIAÇÃO BANCÁRIA R$2,09",
    closing.piggyBank.closingBalance,
  );

  const saved = await getDiaryEntry(BUSINESS, DATE);
  if (!saved?.dayClosing) throw new Error("dayClosing não persistiu");
  if (Math.abs(saved.dayClosing.cash.cashIn - 118) > 0.01) throw new Error("cashIn ≠ 118");
  if (Math.abs(saved.dayClosing.cashManagementResult - 8) > 0.01) throw new Error("resultado ≠ 8");
  if (Math.abs(saved.dayClosing.competenceProfit - 60) > 0.01) throw new Error("lucro ≠ 60");
  if (Math.abs(saved.dayClosing.piggyBank.deposit - 118) > 0.01) throw new Error("depósito ≠ 118");
  if (Math.abs(saved.dayClosing.piggyBank.closingBalance - 4974.61) > 0.01) {
    throw new Error("cofrinho ≠ 4974.61");
  }
  if (Math.abs(saved.dayClosing.piggyBank.bankYield) > 0.001) throw new Error("bankYield deve ser 0");

  // 15 e 16 intactos financeiramente
  const d15 = await getDiaryEntry(BUSINESS, "2026-10-15");
  const d16 = await getDiaryEntry(BUSINESS, "2026-10-16");
  if (!d15?.dayClosing || Math.abs(d15.dayClosing.cash.cashIn - 217) > 0.01) {
    throw new Error("15/10 alterado indevidamente");
  }
  if (!d16?.dayClosing || Math.abs(d16.dayClosing.cash.cashIn - 207) > 0.01) {
    throw new Error("16/10 alterado indevidamente");
  }
  if (Math.abs(d16.dayClosing.costs.ownCost - 93.3) > 0.01) throw new Error("16/10 ownCost alterado");

  console.log(
    `✅ ${DATE} — caixa R$118 · resultado R$8 · competência R$170/R$60 · depósito R$118 · cofrinho observado R$4974,61 (Δ2,09)`,
  );
  console.log("DAY_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
