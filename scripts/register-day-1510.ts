/**
 * Registra 15/10/2026 — fechamento com ressalva (competência provisória).
 * Uso: pnpm tsx scripts/register-day-1510.ts [--dry]
 *
 * Confirmados: Pix 217 · quitações 25 · fiados 25 · custo 110 · resultado/depósito 107 · cofrinho 4725,44
 * Provisórios: fat 198 · lucro competência 88
 * Ressalvas: R$19 sem origem · 2 sanduíches sem vínculo — NÃO criar venda/perda
 */
import "./load-env";
import { and, eq, inArray } from "drizzle-orm";
import { cleanupOperationDay } from "./cleanup-operation-day";
import { commitDayRegistration } from "../src/lib/day-registration/day-registration-service";
import { sanitizeRegistrationPlan } from "../src/lib/day-registration/plan-sanitize";
import type { DayRegistrationPlan, DraftSale } from "../src/lib/day-registration/types";
import { getDiaryEntry, upsertDiaryEntry } from "../src/lib/diary-service";
import { CLOSING_2026_10_15 } from "../src/lib/finance/day-closing";
import { UNIDENTIFIED_FLAVOR_PRODUCT_NAME } from "../src/lib/salgados-flavors";
import { closeDay } from "../src/lib/zaivon/zaivon-service";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { clients, saleItems, sales } from "../src/lib/db/postgres/schema";
import { queryAll, queryRun } from "../src/platform/db/query";
import { countSalesForDate } from "@/platform/db/repositories/sale-repository";

const BUSINESS = "salgados";
const DATE = "2026-10-15";
const SANDUICHE = "Sanduíche Natural";
const SANDUICHE_COST = 2;

const MIKELLY = "Maria Mikelly Monteiro Coutinho";
const GERB = "Gerb da Silva Maganos";
const BERNARDO = "Bernardo Ferreira Domingo";
const JOAO_LUCAS = "Joao Lucas Eloi Pinto";
const JOAO_VICTOR = "Joao Victor Dos Santos Carvalho";
const ANDERSON = "Anderson das Chagas Oliveira";

interface PricedSale {
  sale: DraftSale;
  unitPrice: number;
  sandwich: boolean;
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
 * Histórico Pix → vendas do dia.
 * Excluídos (já quitações / conversão): Sarah 04:58, Paulo 12:54, Anderson R$10, Henrique R$15 (R$5 espécie NI).
 * Anderson R$14 = 2 sanduíches Acal do dia.
 * Não cria venda para o R$19 sem origem nem para 2 sanduíches sem vínculo.
 */
const PRICED: PricedSale[] = [
  salgado("08:16", "Laís Moreira Carvalho", 1),
  salgado("08:52", "Ana C B Nascimento", 1),
  salgado("08:52", "Valentina Macedo Barbosa", 1),
  salgado("08:52", "Nirian Maria Oliveira Do Prado", 1),
  salgado("08:57", "Rayssa De Mesquita Ferreira", 1),
  salgado("09:02", "Maria Clara Gomes Mororo", 1),
  salgado("09:03", "Caio Felipe Teixeira Pereira", 1),
  salgado("09:04", "Pablo Alexandre Santiago Da Silva", 3),
  salgado("09:07", "Ana Luzia Araújo Uchoa", 2),
  salgado("09:14", "Jamilly Facundes Dos Santos", 2),
  salgado("09:15", "Marcela Alves Farias", 1),
  salgado("09:25", "Aluízio Vitoriano Pereira Filho", 1),
  salgado("09:36", "Aline Maria Da Silva Lopes", 1),
  salgado("09:37", "Jackson Mendes Pinheiro", 1),
  salgado("09:37", "Cássio Adriel De Oliveira Silva", 2),
  // Cleane R$12: 1 sanduíche Acal + 1 salgado (composição operacional; competência permanece provisória)
  sanduiche("10:02", "Cleane Cipriano Pereira", 1, 7, {
    notes: "Pix R$12 — sanduíche Acal R$7 + salgado R$5 (composição operacional).",
  }),
  salgado("10:02", "Cleane Cipriano Pereira", 1, {
    notes: "Pix R$12 — parcela salgado R$5.",
  }),
  salgado("10:16", "João Pedro De Souza Pereira Marques", 3),
  salgado("10:53", "Davi Oliveira Da Silva Ayoub", 2),
  sanduiche("12:31", "Francisco Nazareno Da Silva Raquel", 1, 7),
  salgado("12:36", "Suellen Priscilla R Marculino", 1, {
    notes: "Primeiro Pix R$5 das 12:36 — manter separado do segundo.",
  }),
  salgado("12:36", "Suellen Priscilla R Marculino", 1, {
    notes: "Segundo Pix R$5 das 12:36 — manter separado do primeiro.",
  }),
  // Anderson: só a parcela do dia (2 sanduíches). Quitação R$10 já settlement_date=15/10.
  sanduiche("13:38", ANDERSON, 2, 7, {
    notes: "Pix R$24 = quitação R$10 (14/10) + 2 sanduíches Acal R$14 (15/10). Só a parcela do dia.",
  }),
  sanduiche("15:50", "João Pedro Pinto De Farias", 1, 7),
  sanduiche("16:07", "Dayanna Kelly Costa Da Silva", 1, 7),

  // Fiados novos R$25 (5 salgados)
  salgado("18:00", MIKELLY, 1, {
    paymentStatus: "pending",
    notes: "Fiado 15/10 — 1 salgado R$5. Em aberto no fechamento.",
  }),
  salgado("18:01", GERB, 1, {
    paymentStatus: "pending",
    notes: "Fiado 15/10 — 1 salgado R$5. Em aberto no fechamento.",
  }),
  salgado("18:02", BERNARDO, 1, {
    paymentStatus: "pending",
    notes: "Fiado 15/10 — 1 salgado R$5. Em aberto no fechamento.",
  }),
  salgado("18:03", JOAO_LUCAS, 1, {
    paymentStatus: "pending",
    notes: "Fiado 15/10 — 1 salgado R$5. Em aberto. Fiado 13/10 NÃO duplicado.",
  }),
  salgado("18:04", JOAO_VICTOR, 1, {
    paymentStatus: "pending",
    notes: "Fiado 15/10 — 1 salgado R$5. Em aberto no fechamento.",
  }),
];

const closing = CLOSING_2026_10_15;
const RECEIVED = closing.cash.cashIn;
const PENDING = closing.newCredit;
const PROFIT = closing.cashManagementResult;
const OWN_COST = closing.costs.ownCost;
const COFRINHO = closing.piggyBank.closingBalance;

function money(filter: (p: PricedSale) => boolean): number {
  return PRICED.filter(filter).reduce((s, p) => s + p.unitPrice * p.sale.quantity, 0);
}

function checkPlan(): void {
  const paid = (p: PricedSale) => (p.sale.paymentStatus ?? "paid") === "paid";
  const paidMoney = money(paid);
  const fiadoMoney = money((p) => !paid(p));
  const salgadoUnits = PRICED.filter((p) => !p.sandwich).reduce((s, p) => s + p.sale.quantity, 0);
  const sandwichPaidUnits = PRICED.filter((p) => p.sandwich && paid(p)).reduce(
    (s, p) => s + p.sale.quantity,
    0,
  );

  const checks: [string, number, number][] = [
    ["fiados novos R$", fiadoMoney, 25],
    // 33 = 28 pagos + 5 fiados; 1 saída física de salgado fica na ressalva (sem venda nominal).
    ["salgados un registrados (pagos+fiado)", salgadoUnits, 33],
    ["sanduíches pagos identificados un", sandwichPaidUnits, 6],
    ["lucro (caixa − meu custo) R$", RECEIVED - OWN_COST, PROFIT],
    ["cofrinho 14/10 + depósito", 4618.44 + 107, COFRINHO],
    ["cashIn dayClosing", closing.cash.cashIn, 217],
    ["resultado caixa dayClosing", closing.cashManagementResult, 107],
    ["competência provisória", closing.competenceRevenue, 198],
  ];
  for (const [label, got, want] of checks) {
    if (Math.abs(got - want) > 0.001) throw new Error(`Conferência falhou — ${label}: ${got} ≠ ${want}`);
    console.log(`  ✓ ${label}: ${got}`);
  }
  console.log(`  · vendas pagas registradas R$${paidMoney} (KPI de caixa usa dayClosing: vendas 173 + outras 19 + quitações 25)`);
  console.log(`  · sanduíches pagos no histórico ${sandwichPaidUnits} un — redução física 4; 2 sem vínculo individual (ressalva)`);
  if (closing.competenceStatus !== "provisional") throw new Error("15/10 deve ser provisional");
  if (Math.abs((closing.cash.otherInflows ?? 0) - 19) > 0.001) throw new Error("otherInflows ≠ 19");
}

async function applyRealPrices(saleIds: string[]): Promise<void> {
  const db = await getPostgresDb();
  for (let i = 0; i < saleIds.length; i += 1) {
    const { unitPrice, sandwich, sale } = PRICED[i]!;
    const items = await queryAll(db.select().from(saleItems).where(eq(saleItems.saleId, saleIds[i]!)));
    let total = 0;
    let cost = 0;
    for (const item of items) {
      const unitCost = sandwich ? SANDUICHE_COST : Number(item.unitCost);
      const subtotal = unitPrice * item.quantity;
      const itemCost = unitCost * item.quantity;
      total += subtotal;
      cost += itemCost;
      await queryRun(
        db
          .update(saleItems)
          .set({
            unitPrice: unitPrice.toFixed(2),
            unitCost: unitCost.toFixed(2),
            subtotal: subtotal.toFixed(2),
            profit: (subtotal - itemCost).toFixed(2),
          })
          .where(eq(saleItems.id, item.id)),
      );
    }
    const isPaid = (sale.paymentStatus ?? "paid") === "paid";
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

async function assertPriorSettlements(): Promise<void> {
  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({
        name: clients.name,
        total: sales.totalAmount,
        status: sales.paymentStatus,
        settled: sales.settlementDate,
      })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, toDbBusinessId(BUSINESS)),
          eq(sales.settlementDate, DATE),
          inArray(sales.paymentStatus, ["paid"]),
        ),
      ),
  );
  const sum = rows.reduce((s, r) => s + Number(r.total), 0);
  console.log(`  · quitações settlement_date=${DATE}: ${rows.length} venda(s) · R$${sum}`);
  if (Math.abs(sum - 25) > 0.001) {
    throw new Error(`Quitações 15/10 R$${sum} ≠ 25 (Sarah+Anderson+NI+Paulo de 14/10)`);
  }
  console.log("  ✓ quitações antigas R$25 já no banco — não duplicar");
}

async function main() {
  console.log(`Conferência do fechamento 15/10${process.argv.includes("--dry") ? " (DRY)" : ""}:`);
  checkPlan();
  await assertPriorSettlements();
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
    "Fechamento 15/10 — ENCERRADO COM RESSALVA (competência provisória).",
    "Salgados: 34 un · Acal 14 · Unifor 20 · estoque final 0 · fiados novos 5 un R$25 · perdas 0.",
    "Sanduíches: estoque 20→16 (−4). Anderson 2 un Acal R$14 identificadas; 2 un sem vínculo individual (não viram perda nem venda nominal).",
    "Caixa R$217 = vendas estimadas R$173 + quitações R$25 + crédito sem origem R$19.",
    "Crédito R$19: NÃO criar venda/fiado/perda/entrada bancária extra — só ressalva no dayClosing.",
    "Meu custo R$110 · resultado caixa R$107 · depósito R$107 · cofrinho R$4.725,44 (= 4.618,44 + 107).",
    "Faturamento competência PROVISÓRIO R$198 · lucro competência PROVISÓRIO R$88.",
    "Quitações 14/10→15/10 já gravadas (Sarah 5, Anderson 10, NI 5, Paulo 5). Henrique Pix R$15 inclui espécie NI — sem segundo recebimento.",
    "Não afetar 16/10.",
  ];

  const plan: DayRegistrationPlan = {
    businessId: BUSINESS,
    date: DATE,
    purchase: {
      totalUnits: 34,
      investment: OWN_COST,
      ownInvestment: OWN_COST,
      products: [
        { name: "Mistão Frito", quantity: 14 },
        { name: "Queijo Frito", quantity: 6 },
        { name: "Coxinha", quantity: 4 },
        { name: "Frango com Catupiry", quantity: 4 },
        { name: "Mistão de Forno", quantity: 4 },
        { name: "Carne com Cheddar de Forno", quantity: 1 },
        { name: "Croissant", quantity: 1 },
      ],
    },
    summary: {
      revenue: RECEIVED,
      profit: PROFIT,
      quantitySold: 33 + 2,
      quantityLost: 0,
      lossReason: undefined,
      forecastProfit: closing.competenceProfit,
    },
    sales: PRICED.map((p) => p.sale),
    newClients: Array.from(new Set(PRICED.map((p) => p.sale.clientName))).map((name) => ({
      name,
      sector: "Acal",
    })),
    observations: observations.join("\n"),
    manualInsights:
      "Caixa e cofrinho confirmados. Competência provisória (Δ sanduíches sem vínculo + R$19 sem origem). Não forçar igualdade dos indicadores.",
    lessonsLearned:
      "Separar quitação × venda no mesmo Pix (Anderson). Preservar crédito sem origem como ressalva, não como venda.",
  };

  const result = await commitDayRegistration(sanitizeRegistrationPlan(plan));
  if (result.saleIds.length !== PRICED.length) {
    throw new Error(`${result.saleIds.length} vendas gravadas, esperado ${PRICED.length}`);
  }
  await applyRealPrices(result.saleIds);

  const entry = await getDiaryEntry(BUSINESS, DATE);
  if (!entry) throw new Error("diário ausente após commit");

  const { id: _id, createdAt: _c, ...rest } = entry;
  await upsertDiaryEntry({
    ...rest,
    version: 2,
    profit: PROFIT,
    bonusIncome: 0,
    quantitySold: 35,
    quantityLost: 0,
    revenue: {
      received: RECEIVED,
      pending: PENDING,
      total: closing.competenceRevenue,
    },
    dayClosing: closing,
    observations: observations.join("\n"),
    manualInsights: plan.manualInsights,
    lessonsLearned: plan.lessonsLearned,
    sales: {
      paidCount: PRICED.filter((p) => (p.sale.paymentStatus ?? "paid") === "paid").length,
      creditCount: 5,
    },
    tags: Array.from(new Set([...(rest.tags ?? []), "zaivon-v2", "day-closing-v2", "provisional"])),
  });

  await closeDay(DATE, "closed_with_note", "Competência provisória · crédito R$19 sem origem · 2 sanduíches sem vínculo", COFRINHO);

  const saved = await getDiaryEntry(BUSINESS, DATE);
  if (!saved?.dayClosing) throw new Error("dayClosing não persistiu");
  if (saved.dayClosing.competenceStatus !== "provisional") throw new Error("status ≠ provisional");
  if (Math.abs(saved.dayClosing.cash.cashIn - 217) > 0.001) throw new Error("cashIn ≠ 217");
  if (Math.abs(saved.dayClosing.cashManagementResult - 107) > 0.001) throw new Error("resultado ≠ 107");
  if (Math.abs(saved.dayClosing.piggyBank.closingBalance - 4725.44) > 0.001) {
    throw new Error("cofrinho ≠ 4725.44");
  }

  console.log(
    `✅ ${DATE} — caixa R$217 · resultado R$107 · competência provisória R$198/R$88 · fiados R$25 · cofrinho R$4725,44 · ressalva R$19`,
  );
  console.log("DAY_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
