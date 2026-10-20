/**
 * Registra 16/10/2026 — parcialmente conciliado (sanduíches → 19/10).
 * Uso: pnpm tsx scripts/register-day-1610.ts [--dry]
 *
 * Confirmados: caixa 207 · custo 93,30 · depósito 127 · cofrinho 4854,52 · salgados 29→0
 * Quitações 16/10: Mikelly 43 + Gerb 5 + JV 5 = 53
 * Posteriores (não no caixa 16/10): João Lucas 10 em 17/10 · Carlos 10 (8+2) em 18/10
 */
import "./load-env";
import { and, asc, eq, inArray } from "drizzle-orm";
import { cleanupOperationDay } from "./cleanup-operation-day";
import { commitDayRegistration } from "../src/lib/day-registration/day-registration-service";
import { sanitizeRegistrationPlan } from "../src/lib/day-registration/plan-sanitize";
import type { DayRegistrationPlan, DraftSale } from "../src/lib/day-registration/types";
import { getDiaryEntry, upsertDiaryEntry } from "../src/lib/diary-service";
import { CLOSING_2026_10_16 } from "../src/lib/finance/day-closing";
import { UNIDENTIFIED_FLAVOR_PRODUCT_NAME } from "../src/lib/salgados-flavors";
import { closeDay, markDebtAsLoss, registerPayment } from "../src/lib/zaivon/zaivon-service";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { clients, saleItems, sales } from "../src/lib/db/postgres/schema";
import { queryAll, queryRun } from "../src/platform/db/query";
import { countSalesForDate } from "@/platform/db/repositories/sale-repository";

const BUSINESS = "salgados";
const DATE = "2026-10-16";
const D17 = "2026-10-17";
const D18 = "2026-10-18";
const SANDUICHE = "Sanduíche Natural";
const SANDUICHE_COST = 2;

const MIKELLY = "Maria Mikelly Monteiro Coutinho";
const GERB = "Gerb da Silva Maganos";
const BERNARDO = "Bernardo Ferreira Domingo";
const JOAO_LUCAS = "Joao Lucas Eloi Pinto";
const JOAO_VICTOR = "João Victor dos Santos Carvalho";
const ANA_LAURA = "Ana Laura";
const CARLOS = "Carlos Eduardo";
const LOSS_CLIENT = "Retirada não identificada (2026-10-16)";

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

const PRICED: PricedSale[] = [
  // —— Unifor Pix nominais R$35 (7 un) ——
  salgado("09:17", "Ana C B Nascimento", 1, { department: "Unifor" }),
  salgado("09:17", "Sarah Lívia Ribeiro Lopes", 1, { department: "Unifor" }),
  salgado("09:20", "Wagner Filho Peixoto Abreu", 1, { department: "Unifor" }),
  salgado("09:24", "André Malgarisi Costa", 1, { department: "Unifor" }),
  salgado("09:30", "Saulo de Abreu Saraiva", 2, { department: "Unifor" }),
  salgado("09:41", "Maria Beatriz Alves dos Santos", 1, { department: "Unifor" }),
  // Espécie Unifor → Pix via Henrique (5 un R$25) — conversão, não faturamento extra
  salgado("11:00", "Unifor espécie (repasse Henrique)", 5, {
    department: "Unifor",
    paymentMethod: "cash",
    notes: "Cinco salgados Unifor em espécie convertidos em Pix pelo Henrique (R$25). Não duplicar.",
  }),

  // —— Acal salgados R$80 (16 un) ——
  salgado("09:20", "Diego Martins Pinheiro", 2),
  salgado("09:23", "Raimunda Raimunda Sousa", 1),
  salgado("09:26", "Maria Clara Gomes Mororo", 1),
  salgado("09:35", "João Pedro de Souza Pereira", 2),
  salgado("09:45", "Cássio Adriel de Oliveira Silva", 1),
  salgado("09:51", "Cleane Cipriano Pereira", 1),
  salgado("10:03", GERB, 1, {
    notes: "Pix total R$10 = venda 16/10 R$5 + quitação fiado 15/10 R$5. Atribuição da conciliação (pode exigir confirmação).",
  }),
  salgado("10:04", "Anderson da Silva Nascimento", 1),
  salgado("10:23", "Lucas Moraes", 1),
  salgado("12:29", "Suellen Priscilla R Marculino", 1),
  salgado("13:03", "Gerson Ryan Silva de Oliveira", 1),
  salgado("13:04", "Pedro Iago Lopes de Oliveira", 1),
  salgado("13:13", "João Pedro Pinto de Farias", 1),
  salgado("15:17", "Francisco Ricardo Feijão Pinho", 1),

  // —— Sanduíches pagos identificados R$14 ——
  sanduiche("08:32", "Letícia Santana Rodrigues", 1, 7, {
    notes: "1 sanduíche Acal R$7.",
  }),
  sanduiche("16:48", "Natália Almeida Da Silva Souza", 1, 7, {
    notes:
      "Pix R$7 ~16h48. INCERTO: quitação de retirada anterior OU nova retirada pós-contagem 16h. Estoque físico às 16h permanece 7 — não baixar estoque automaticamente.",
  }),

  // —— Fiados novos Ana Laura (+2 sanduíches → saldo conhecido 4×R$7=R$28) ——
  sanduiche("18:00", ANA_LAURA, 1, 7, {
    paymentStatus: "pending",
    notes:
      "Fiado Ana Laura — sanduíche Acal. Acordo: acumular até 5º dia útil de novembro (noite). Sem cobrança antecipada automática.",
  }),
  sanduiche("18:01", ANA_LAURA, 1, 7, {
    paymentStatus: "pending",
    notes:
      "Fiado Ana Laura — sanduíche Acal (2/2 novos em 16/10). Total conhecido em aberto com os de 07/10 e 09/10: R$28.",
  }),

  // —— Perda recuperável 1 salgado R$5 ——
  {
    ...salgado("18:30", LOSS_CLIENT, 1, {
      paymentStatus: "pending",
      paymentMethod: "cash",
      notes:
        "Perda por retirada não identificada após conciliação 16/10. Recuperável posteriormente. NÃO é dinheiro recebido. NÃO atribuir a cliente sem evidência.",
    }),
    isLoss: true,
  },
];

const closing = CLOSING_2026_10_16;

function money(filter: (p: PricedSale) => boolean): number {
  return PRICED.filter(filter).reduce((s, p) => s + p.unitPrice * p.sale.quantity, 0);
}

function checkPlan(): void {
  const paid = (p: PricedSale) => (p.sale.paymentStatus ?? "paid") === "paid" && !p.isLoss;
  const paidSalgado = money((p) => paid(p) && !p.sandwich);
  const paidSandwich = money((p) => paid(p) && p.sandwich);
  const fiadoNew = money((p) => (p.sale.paymentStatus ?? "paid") === "pending" && !p.isLoss);
  const salgadoUnits = PRICED.filter((p) => !p.sandwich).reduce((s, p) => s + p.sale.quantity, 0);
  const lossUnits = PRICED.filter((p) => p.isLoss).reduce((s, p) => s + p.sale.quantity, 0);

  const checks: [string, number, number][] = [
    ["salgados pagos R$", paidSalgado, 140],
    ["sanduíches pagos R$", paidSandwich, 14],
    ["vendas atuais R$", paidSalgado + paidSandwich, 154],
    ["fiados novos Ana Laura R$", fiadoNew, 14],
    ["salgados un (pagos+perda)", salgadoUnits, 29],
    ["perda un", lossUnits, 1],
    ["cashIn", closing.cash.cashIn, 207],
    ["quitações", closing.cash.priorSettlements, 53],
    ["resultado caixa", closing.cashManagementResult, 113.7],
    ["depósito", closing.piggyBank.deposit, 127],
    ["cofrinho final", closing.piggyBank.closingBalance, 4854.52],
    ["competência", closing.competenceRevenue, 168],
  ];
  for (const [label, got, want] of checks) {
    if (Math.abs(got - want) > 0.01) throw new Error(`Conferência falhou — ${label}: ${got} ≠ ${want}`);
    console.log(`  ✓ ${label}: ${got}`);
  }
  if (closing.competenceStatus !== "provisional") throw new Error("16/10 deve ser provisional");
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

async function settleBySaleDate(
  clientName: string,
  saleDate: string,
  settlementDate: string,
  expectedAmount: number,
  note: string,
): Promise<void> {
  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({ id: sales.id, total: sales.totalAmount, status: sales.paymentStatus })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, toDbBusinessId(BUSINESS)),
          eq(sales.saleDate, saleDate),
          eq(clients.name, clientName),
          inArray(sales.paymentStatus, ["pending", "partial"]),
        ),
      ),
  );
  if (rows.length === 0) throw new Error(`Fiado ${clientName} @ ${saleDate} não encontrado`);
  const total = rows.reduce((s, r) => s + Number(r.total), 0);
  if (Math.abs(total - expectedAmount) > 0.01) {
    throw new Error(`Fiado ${clientName} @ ${saleDate}: R$${total} ≠ R$${expectedAmount}`);
  }
  for (const row of rows) {
    await queryRun(
      db
        .update(sales)
        .set({
          paymentStatus: "paid",
          amountReceived: Number(row.total).toFixed(2),
          settlementDate,
          notes: note,
          updatedAt: new Date(),
        })
        .where(eq(sales.id, row.id)),
    );
  }
  console.log(`  ✓ quitado ${clientName} (${saleDate}) → ${settlementDate} · R$${total}`);
}

/** Quita Mikelly R$43 (mais antigas primeiro), alvo operacional restante R$7. */
async function settleMikelly43(): Promise<void> {
  const result = await registerPayment(MIKELLY, 43, DATE, { addToDiary: false });
  console.log(`  ✓ Mikelly quitação R$43 · settled=${result.settled} · extra=${result.extra}`);
  if (Math.abs(result.settled - 43) > 0.01) {
    throw new Error(`Mikelly settled ${result.settled} ≠ 43`);
  }

  const db = await getPostgresDb();
  const open = await queryAll(
    db
      .select({ total: sales.totalAmount, date: sales.saleDate, received: sales.amountReceived, status: sales.paymentStatus })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, toDbBusinessId(BUSINESS)),
          eq(clients.name, MIKELLY),
          inArray(sales.paymentStatus, ["pending", "partial"]),
        ),
      )
      .orderBy(asc(sales.saleDate)),
  );
  const remaining = open.reduce((s, r) => {
    const t = Number(r.total) || 0;
    const a = r.status === "partial" ? Number(r.received) || 0 : 0;
    return s + (t - a);
  }, 0);
  console.log(`  · Mikelly em aberto após quitação: R$${remaining} (${open.length} venda(s)) — alvo operacional R$7`);
  if (Math.abs(remaining - 7) > 0.01) {
    console.log(
      `  ⚠ INCONSISTÊNCIA: saldo Mikelly sistema R$${remaining} ≠ R$7 informado. Preservado sem exclusão; revisar conciliação.`,
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
  console.log(`  ✓ perda marcada lossSaleIds · ${rows[0]!.id.slice(0, 8)}`);
}

async function ensureAnaLauraOpen28(): Promise<void> {
  const db = await getPostgresDb();
  const open = await queryAll(
    db
      .select({ total: sales.totalAmount })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, toDbBusinessId(BUSINESS)),
          eq(clients.name, ANA_LAURA),
          inArray(sales.paymentStatus, ["pending", "partial"]),
        ),
      ),
  );
  const sum = open.reduce((s, r) => s + Number(r.total), 0);
  console.log(`  · Ana Laura em aberto: R$${sum} (alvo R$28)`);
  if (Math.abs(sum - 28) > 0.01) {
    throw new Error(`Ana Laura aberto R$${sum} ≠ 28`);
  }
}

async function recordLaterSettlements(): Promise<void> {
  // 17/10 — João Lucas R$10 (dívida sistema R$5 + R$5 sem vínculo prévio → extraSettlements)
  const jl = await registerPayment(JOAO_LUCAS, 10, D17, { addToDiary: false });
  console.log(`  ✓ João Lucas 17/10 R$10 · settled=${jl.settled} · extra=${jl.extra}`);

  // 18/10 — Carlos R$8 dívida + R$2 extraordinário
  await settleBySaleDate(
    CARLOS,
    "2026-10-14",
    D18,
    8,
    "Quitação 18/10 R$8 (sanduíche Unifor). Pix total R$10: R$2 receita extraordinária — sem venda de produto / sem juros.",
  );
  const carlosExtra = await registerPayment(CARLOS, 2, D18, { addToDiary: false });
  console.log(`  ✓ Carlos R$2 extraordinário 18/10 · settled=${carlosExtra.settled} · extra=${carlosExtra.extra}`);
}

async function main() {
  console.log(`Conferência do fechamento 16/10${process.argv.includes("--dry") ? " (DRY)" : ""}:`);
  checkPlan();

  if (process.argv.includes("--dry")) {
    console.log("DRY_OK");
    process.exit(0);
  }

  const existing = await countSalesForDate(BUSINESS, DATE);
  if (existing > 0) {
    throw new Error(`${DATE}: já existem ${existing} venda(s). Abortando para não duplicar.`);
  }

  await cleanupOperationDay(BUSINESS, DATE);

  const observations = [
    "Fechamento 16/10 — PARCIALMENTE CONCILIADO (sanduíches → conferência 19/10).",
    "Salgados: 29 un · pagos 28 R$140 · perda recuperável 1 R$5 · estoque final 0 · custo R$93,30.",
    "Unifor R$60 (Pix 35 + espécie→Pix Henrique 25). Acal salgados R$80.",
    "Sanduíches: inicial 16 · consumo próprio 2 · contagem 16h = 7 · pagos Letícia+Natália R$14. Anônimos 5–6 un NÃO viram perda.",
    "Natália R$7: movimento incerto (quitação anterior vs retirada pós-16h) — estoque 7 preservado.",
    "Caixa R$207 = vendas 154 + quitações 53 (Mikelly 43 + Gerb 5 + JV 5).",
    "Resultado caixa R$113,70 ≠ depósito R$127 (distribuição acumulado 16–18; reserva custos R$100 p/ 20/10).",
    "Cofrinho: abertura 4727,52 + 127 = 4854,52 (transferência REALIZADA).",
    "17/10 João Lucas R$10 e 18/10 Carlos R$10 fora do caixa 16/10.",
    "Custo sanduíches: não reapropriar (estoque 15/10).",
  ];

  const plan: DayRegistrationPlan = {
    businessId: BUSINESS,
    date: DATE,
    purchase: {
      totalUnits: 29,
      investment: closing.costs.ownCost,
      ownInvestment: closing.costs.ownCost,
      products: [{ name: UNIDENTIFIED_FLAVOR_PRODUCT_NAME, quantity: 29 }],
    },
    summary: {
      revenue: closing.cash.cashIn,
      profit: closing.cashManagementResult,
      quantitySold: 28 + 2 + 2, // salgados pagos + sanduíches pagos + Ana Laura fiados (perda à parte)
      quantityLost: 1,
      lossReason: "Retirada de salgado sem pagamento identificado — perda recuperável.",
      forecastProfit: closing.competenceProfit,
    },
    sales: PRICED.map((p) => p.sale),
    newClients: Array.from(new Set(PRICED.map((p) => p.sale.clientName))).map((name) => ({
      name,
      sector: name.includes("Unifor") ? "Unifor" : "Acal",
    })),
    observations: observations.join("\n"),
    manualInsights:
      "Parcialmente conciliado. Caixa/cofrinho/salgados confirmados. Sanduíches pendentes até 19/10. Não forçar resultado caixa = depósito.",
    lessonsLearned:
      "Separar espécie→Pix (Henrique) de venda nova. Gerb R$10 = venda + quitação. Natália: não baixar estoque sem evidência.",
  };

  const result = await commitDayRegistration(sanitizeRegistrationPlan(plan));
  if (result.saleIds.length !== PRICED.length) {
    throw new Error(`${result.saleIds.length} vendas gravadas, esperado ${PRICED.length}`);
  }
  await applyRealPrices(result.saleIds);
  await markLossSale();

  // Quitações do dia (não duplicar no diário — dayClosing já tem priorSettlements)
  await settleMikelly43();
  await settleBySaleDate(
    GERB,
    "2026-10-15",
    DATE,
    5,
    "Quitação 15/10 via Pix Gerb 16/10 (parcela R$5 do Pix R$10). Atribuição da conciliação.",
  );
  await settleBySaleDate(
    JOAO_VICTOR,
    "2026-10-15",
    DATE,
    5,
    "Quitação 15/10 — Pix R$5 às 20h55 em 16/10.",
  );
  await ensureAnaLauraOpen28();

  // Posteriores
  await recordLaterSettlements();

  // Bernardo permanece R$5 — conferir
  const db = await getPostgresDb();
  const bernardo = await queryAll(
    db
      .select({ total: sales.totalAmount, status: sales.paymentStatus })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, toDbBusinessId(BUSINESS)),
          eq(clients.name, BERNARDO),
          eq(sales.saleDate, "2026-10-15"),
          eq(sales.paymentStatus, "pending"),
        ),
      ),
  );
  if (bernardo.length !== 1 || Math.abs(Number(bernardo[0]!.total) - 5) > 0.01) {
    throw new Error("Bernardo 15/10 deveria permanecer R$5 pending");
  }
  console.log("  ✓ Bernardo 15/10 permanece R$5 em aberto");

  const entry = await getDiaryEntry(BUSINESS, DATE);
  if (!entry) throw new Error("diário ausente após commit");

  const { id: _id, createdAt: _c, ...rest } = entry;
  await upsertDiaryEntry({
    ...rest,
    version: 2,
    profit: closing.cashManagementResult,
    bonusIncome: 0,
    quantitySold: 32,
    quantityLost: 1,
    lossReason: "Retirada de salgado sem pagamento identificado — perda recuperável.",
    revenue: {
      received: closing.cash.cashIn,
      pending: closing.newCredit,
      total: closing.competenceRevenue,
    },
    purchase: {
      totalUnits: 29,
      investment: closing.costs.ownCost,
      ownInvestment: closing.costs.ownCost,
      products: [{ name: UNIDENTIFIED_FLAVOR_PRODUCT_NAME, quantity: 29 }],
    },
    dayClosing: closing,
    observations: observations.join("\n"),
    manualInsights: plan.manualInsights,
    lessonsLearned: plan.lessonsLearned,
    sales: {
      paidCount: PRICED.filter((p) => (p.sale.paymentStatus ?? "paid") === "paid").length,
      creditCount: 2,
    },
    tags: Array.from(
      new Set([...(rest.tags ?? []), "zaivon-v2", "day-closing-v2", "provisional", "partial-reconcile-1610"]),
    ),
  });

  await closeDay(
    DATE,
    "closed_with_note",
    "PARCIALMENTE CONCILIADO — sanduíches aguardam 19/10 · depósito R$127 realizado · perda salgado R$5 recuperável",
    closing.piggyBank.closingBalance,
  );

  const saved = await getDiaryEntry(BUSINESS, DATE);
  if (!saved?.dayClosing) throw new Error("dayClosing não persistiu");
  if (saved.dayClosing.competenceStatus !== "provisional") throw new Error("status ≠ provisional");
  if (Math.abs(saved.dayClosing.cash.cashIn - 207) > 0.01) throw new Error("cashIn ≠ 207");
  if (Math.abs(saved.dayClosing.cashManagementResult - 113.7) > 0.01) throw new Error("resultado ≠ 113.70");
  if (Math.abs(saved.dayClosing.piggyBank.deposit - 127) > 0.01) throw new Error("depósito ≠ 127");
  if (Math.abs(saved.dayClosing.piggyBank.closingBalance - 4854.52) > 0.01) {
    throw new Error("cofrinho ≠ 4854.52");
  }

  // 15/10 intacto
  const d15 = await getDiaryEntry(BUSINESS, "2026-10-15");
  if (!d15?.dayClosing || Math.abs(d15.dayClosing.cash.cashIn - 217) > 0.01) {
    throw new Error("15/10 foi alterado indevidamente");
  }

  console.log(
    `✅ ${DATE} — caixa R$207 · resultado R$113,70 · competência provisória R$168/R$74,70 · depósito R$127 · cofrinho R$4854,52 · parcial`,
  );
  console.log("DAY_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
