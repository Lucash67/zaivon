/**
 * Registra 14/10/2026 — Salgados + Sanduíche Natural (fechamento em 4 blocos nas Notas).
 * Uso: pnpm tsx scripts/register-day-1410.ts [--dry]
 *
 *   caixa R$231 (R$211 vendas + R$20 quitação Henrique 13/10)
 *   meu custo R$100 · terceiros R$44,40 · custo novo R$144,40
 *   lucro R$131 = 231 − 100 (regra oficial: caixa − meu custo)
 *   fiados novos R$40 · perdas 5 sanduíches R$35 · cofrinho R$4.618,44
 */
import "./load-env";
import { and, eq, inArray } from "drizzle-orm";
import { cleanupOperationDay } from "./cleanup-operation-day";
import { commitDayRegistration } from "../src/lib/day-registration/day-registration-service";
import { sanitizeRegistrationPlan } from "../src/lib/day-registration/plan-sanitize";
import type { DayRegistrationPlan, DraftSale } from "../src/lib/day-registration/types";
import { getDiaryEntry, upsertDiaryEntry } from "../src/lib/diary-service";
import { UNIDENTIFIED_FLAVOR_PRODUCT_NAME } from "../src/lib/salgados-flavors";
import { closeDay, registerPayment } from "../src/lib/zaivon/zaivon-service";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { clients, saleItems, sales } from "../src/lib/db/postgres/schema";
import { queryAll, queryRun } from "../src/platform/db/query";
import { countSalesForDate } from "@/platform/db/repositories/sale-repository";

const BUSINESS = "salgados";
const DATE = "2026-10-14";
const PREV = "2026-10-13";
const NEXT = "2026-10-15";
const SANDUICHE = "Sanduíche Natural";
const SANDUICHE_COST = 2;

const HENRIQUE = "Henrique Alberto Matos Da Rocha";
const MIKELLY = "Maria Mikelly Monteiro Coutinho";
const SARAH = "Sarah";
const ANDERSON = "Anderson das Chagas Oliveira";
const PAULO = "Paulo André Carvalho";
const CARLOS = "Carlos Eduardo";
const NI = "Cliente Não Identificado (2026-10-14)";

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

const ESPECIE = {
  paymentMethod: "cash" as const,
  notes: "Pago em espécie, convertido em Pix pelo Henrique (R$25 às 11:55).",
};

const PRICED: PricedSale[] = [
  // —— Salgados pagos (histórico PIX) ——
  salgado("08:52", "Maria Clara Gomes Mororo", 1),
  salgado("08:52", "Caio Felipe Teixeira Pereira", 1),
  salgado("09:00", "Samuel De Sampaio Melo Landim", 1),
  salgado("09:00", "Luise Mariane De Freitas Rêgo Costa", 1),
  salgado("09:03", "Cássio Adriel De Oliveira Silva", 2),
  salgado("09:04", "Cássio Adriel De Oliveira Silva", 1),
  salgado("09:06", "Leonardo De Sousa Sena", 2),
  salgado("09:09", "Joaquim Neto", 1),
  salgado("09:24", "Igor Silva Vieira", 1),
  salgado("09:25", "Cliente Tap to Pay", 1, {
    notes: "Tap to Pay R$5,20 — contabilizado R$5,00 no faturamento.",
  }),
  salgado("09:30", "Anna Rebeca Menezes Sousa", 2),
  salgado("09:34", "Rhenan Mateus Matias Filgueira", 2),
  sanduiche("09:37", "Esley Edilon Vieira Gomes", 1, 8, { department: "Unifor" }),
  salgado("09:37", "Ana C B Nascimento", 1),
  salgado("09:40", "Jose Gabriel De Oliveira Abreu Matos", 1),
  salgado("09:41", "Joao Guilherme Da Silva Lima", 2),
  salgado("11:04", "Joao Victor Dos Santos Carvalho", 1),
  salgado("11:07", "Francisco Nazareno Da Silva Raquel", 1),
  sanduiche("11:40", "Raimunda Raimunda Sousa", 1, 7),
  // Espécie R$25 (5 salgados) — Pix do Henrique só converte, não é venda extra
  salgado("11:55", "Cliente Espécie Acal #1", 1, ESPECIE),
  salgado("11:55", "Cliente Espécie Acal #2", 1, ESPECIE),
  salgado("11:55", "Cliente Espécie Acal #3", 1, ESPECIE),
  salgado("11:55", "Cliente Espécie Acal #4", 1, ESPECIE),
  salgado("11:55", "Cliente Espécie Acal #5", 1, ESPECIE),
  salgado("12:27", "Maria Eduarda Viana Pereira", 1),
  salgado("12:29", "Shirley Lima Vieira", 1),
  salgado("13:11", "Jose Gabriel Santos De Azevedo", 1),
  salgado("13:13", "Davi Oliveira Da Silva Ayoub", 1),
  salgado("14:57", "Claudia Roberta Gagliardi", 1),
  salgado("15:06", "Pedro Iago Lopes De Oliveira", 2),
  salgado("15:09", "Gerson Ryan Silva De Oliveira", 1),
  sanduiche("15:22", "Antonia Goiana Basilio", 1, 7),
  sanduiche("15:35", "Thalita Hivia De Almeida Freitas", 1, 7),
  sanduiche("16:19", "Ana Angelica Magalhaes Martins", 1, 7),

  // —— Fiados de 14/10 (R$40) ——
  salgado("18:00", SARAH, 1, {
    department: "Unifor",
    paymentStatus: "pending",
    notes: "Fiado 14/10 — 1 salgado Unifor R$5. Quitado em 15/10.",
  }),
  salgado("18:01", ANDERSON, 2, {
    paymentStatus: "pending",
    notes: "Fiado 14/10 — 2 salgados Acal R$10. Quitado em 15/10.",
  }),
  salgado("18:02", NI, 1, {
    paymentStatus: "pending",
    notes: "Fiado 14/10 — 1 salgado sem nome R$5. Quitado em 15/10.",
  }),
  salgado("18:03", PAULO, 1, {
    paymentStatus: "pending",
    notes: "Fiado 14/10 — 1 salgado R$5. Quitado em 15/10.",
  }),
  sanduiche("18:04", CARLOS, 1, 8, {
    department: "Unifor",
    paymentStatus: "pending",
    notes: "Fiado 14/10 — 1 sanduíche Unifor R$8. Em aberto.",
  }),
  sanduiche("18:05", MIKELLY, 1, 7, {
    paymentStatus: "pending",
    notes: "Fiado 14/10 — 1 sanduíche Acal R$7. Em aberto.",
  }),
];

const RECEIVED = 231;
const PENDING = 40;
const PROFIT = 131;
const OWN_COST = 100;
const THIRD_COST = 44.4;
const LOST = 5;
const COFRINHO = 4618.44;
const FATURAMENTO = 251;

function units(sandwich: boolean): number {
  return PRICED.filter((p) => p.sandwich === sandwich).reduce((s, p) => s + p.sale.quantity, 0);
}

function money(filter: (p: PricedSale) => boolean): number {
  return PRICED.filter(filter).reduce((s, p) => s + p.unitPrice * p.sale.quantity, 0);
}

function checkPlan(): void {
  const paid = (p: PricedSale) => (p.sale.paymentStatus ?? "paid") === "paid";
  const checks: [string, number, number][] = [
    ["salgados vendidos (pagos+fiado)", units(false), 40],
    ["sanduíches vendidos (pagos+fiado)", units(true), 7],
    ["salgados pagos un", PRICED.filter((p) => !p.sandwich && paid(p)).reduce((s, p) => s + p.sale.quantity, 0), 35],
    ["sanduíches pagos un", PRICED.filter((p) => p.sandwich && paid(p)).reduce((s, p) => s + p.sale.quantity, 0), 5],
    ["recebido das vendas R$", money(paid), 211],
    ["fiado novo R$", money((p) => !paid(p)), PENDING],
    ["faturamento R$", money(() => true), FATURAMENTO],
    ["caixa (vendas + quitação Henrique) R$", money(paid) + 20, RECEIVED],
    ["lucro (caixa − meu custo) R$", RECEIVED - OWN_COST, PROFIT],
    ["custo novo R$", OWN_COST + THIRD_COST, 144.4],
    ["estoque sanduíches (vendidos+perda+sobra)", units(true) + LOST + 2, 14],
  ];
  for (const [label, got, want] of checks) {
    if (Math.abs(got - want) > 0.001) throw new Error(`Conferência falhou — ${label}: ${got} ≠ ${want}`);
    console.log(`  ✓ ${label}: ${got}`);
  }
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

async function settle(
  clientName: string,
  saleDate: string,
  settlementDate: string,
  note: string,
  expectedAmount?: number,
): Promise<void> {
  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({ id: sales.id, total: sales.totalAmount })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, toDbBusinessId(BUSINESS)),
          eq(sales.saleDate, saleDate),
          inArray(sales.paymentStatus, ["pending", "partial"]),
          eq(clients.name, clientName),
        ),
      ),
  );
  if (rows.length === 0) throw new Error(`Fiado de ${clientName} em ${saleDate}: nenhum encontrado`);
  const total = rows.reduce((s, r) => s + Number(r.total), 0);
  if (expectedAmount != null && Math.abs(total - expectedAmount) > 0.001) {
    throw new Error(`Fiado de ${clientName} em ${saleDate}: R$${total} ≠ R$${expectedAmount}`);
  }
  for (const row of rows) {
    await queryRun(
      db
        .update(sales)
        .set({
          paymentStatus: "paid",
          amountReceived: row.total,
          settlementDate,
          notes: note,
          updatedAt: new Date(),
        })
        .where(eq(sales.id, row.id)),
    );
  }
  console.log(`  ✓ quitado ${clientName} (${saleDate}) em ${settlementDate} · R$${total}`);
}

async function main() {
  console.log("Conferência do fechamento 14/10:");
  checkPlan();
  if (process.argv.includes("--dry")) {
    console.log("DRY_OK");
    process.exit(0);
  }

  await cleanupOperationDay(BUSINESS, DATE);
  const existing = await countSalesForDate(BUSINESS, DATE);
  if (existing > 0) throw new Error(`${DATE}: ainda ${existing} venda(s) após cleanup`);

  const observations = [
    "Fechamento 14/10 em 4 blocos (Notas) — conciliado.",
    "Salgados: 40 un (encomenda 32 R$100 + reposição 8 R$24,40 = R$124,40) · Unifor 18 · Acal 22 · pagos 35 · fiados 5 · perdas 0 · estoque 0.",
    "Sanduíches: 14 disponíveis (10 novos R$20 + 4 de 13/10) · pagos 5 (R$36) · fiados 2 (R$15) · perdas 5 (R$35) · sobra 2 na Acal.",
    "Caixa R$231 = R$211 das vendas do dia + R$20 quitação Henrique (4 salgados de 13/10).",
    "Espécie R$25 convertido em Pix pelo Henrique (11:55) — já dentro do caixa; Tap to Pay R$5,20 → R$5.",
    "Custo novo R$144,40 · meu custo R$100 · terceiros R$44,40 · bonificação R$0.",
    "Lucro oficial R$131 = caixa 231 − meu custo 100 (transferido ao cofrinho). Lucro sobre faturamento 251 − 100 = R$151 (diferença contábil R$20 = quitação antiga).",
    "Cofrinho prático R$4.618,44 (= 4.483,49 + 131 + R$3,95 rendimento).",
    "Fiados novos R$40; em 15/10 já quitados R$25 (Sarah, Anderson, NI, Paulo André). Ficam abertos Carlos Eduardo R$8 + Mikelly R$7 deste dia.",
  ];

  const plan: DayRegistrationPlan = {
    businessId: BUSINESS,
    date: DATE,
    purchase: {
      totalUnits: 50,
      investment: OWN_COST + THIRD_COST,
      ownInvestment: OWN_COST,
      thirdParty: { name: "Terceiros", amount: THIRD_COST },
      products: [
        { name: "Mistão Frito", quantity: 18 },
        { name: "Queijo Frito", quantity: 8 },
        { name: "Coxinha", quantity: 4 },
        { name: "Frango com Catupiry", quantity: 4 },
        { name: "Mistão de Forno", quantity: 4 },
        { name: "Carne com Cheddar de Forno", quantity: 1 },
        { name: "Croissant", quantity: 1 },
        { name: SANDUICHE, quantity: 10 },
      ],
    },
    summary: {
      revenue: RECEIVED,
      profit: PROFIT,
      quantitySold: 47,
      quantityLost: LOST,
      lossReason:
        "5 sanduíches retirados sem pagamento/identificação na Acal — perda definitiva (R$35).",
      forecastProfit: 151,
    },
    sales: PRICED.map((p) => p.sale),
    newClients: Array.from(new Set(PRICED.map((p) => p.sale.clientName))).map((name) => ({
      name,
      sector:
        name === HENRIQUE
          ? "Colegas do Henrique"
          : name === SARAH || name === CARLOS || name === "Esley Edilon Vieira Gomes"
            ? "Unifor"
            : "Acal",
    })),
    observations: observations.join("\n"),
    manualInsights:
      "Bom volume (faturamento R$251 / 83% da projeção R$302). Perda de 5 sanduíches na Acal e espécie R$25 convertida via Henrique.",
    lessonsLearned:
      "Controlar retiradas de sanduíche na Acal; registrar fiados no mesmo dia; espécie sempre nominal.",
  };

  const result = await commitDayRegistration(sanitizeRegistrationPlan(plan));
  if (result.saleIds.length !== PRICED.length) {
    throw new Error(`${result.saleIds.length} vendas gravadas, esperado ${PRICED.length}`);
  }
  await applyRealPrices(result.saleIds);

  const entry = await getDiaryEntry(BUSINESS, DATE);
  if (!entry) throw new Error("diário ausente");
  await upsertDiaryEntry({
    ...entry,
    profit: PROFIT,
    bonusIncome: 0,
    quantitySold: 47,
    quantityLost: LOST,
    lossReason: plan.summary.lossReason,
    revenue: { received: RECEIVED, pending: PENDING, total: RECEIVED + PENDING },
    observations: plan.observations,
    manualInsights: plan.manualInsights,
    lessonsLearned: plan.lessonsLearned,
    sales: { paidCount: PRICED.filter((p) => (p.sale.paymentStatus ?? "paid") === "paid").length, creditCount: 6 },
    tags: Array.from(new Set([...(entry.tags ?? []), "zaivon-v2"])),
  });

  // Quitação Henrique R$20 (4 salgados 13/10): não havia venda pendente no sistema —
  // entra como extraSettlement; o valor já está no caixa RECEIVED (addToDiary: false).
  const henriquePay = await registerPayment(HENRIQUE, 20, DATE, { addToDiary: false });
  console.log(`  ✓ Henrique R$20 em ${DATE} · settled=${henriquePay.settled} · extra=${henriquePay.extra}`);

  await settle(SARAH, DATE, NEXT, "Fiado 14/10 quitado em 15/10.", 5);
  await settle(ANDERSON, DATE, NEXT, "Fiado 14/10 quitado em 15/10.", 10);
  await settle(NI, DATE, NEXT, "Fiado 14/10 quitado em 15/10.", 5);
  await settle(PAULO, DATE, NEXT, "Fiado 14/10 quitado em 15/10.", 5);

  await closeDay(DATE, "closed", undefined, COFRINHO);

  const saved = await getDiaryEntry(BUSINESS, DATE);
  if (!saved || saved.profit !== PROFIT || saved.revenue.received !== RECEIVED || saved.revenue.pending !== PENDING) {
    throw new Error(
      `diário não fechou: profit=${saved?.profit} received=${saved?.revenue.received} pending=${saved?.revenue.pending}`,
    );
  }
  console.log(
    `✅ ${DATE} — lucro R$${saved.profit} · caixa R$${RECEIVED} · fiado R$${PENDING} · ${PRICED.length} vendas · perdas ${saved.quantityLost} · cofrinho R$${COFRINHO}`,
  );
  console.log("DAY_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
